# PKFare Integration Guide (step-by-step)

How to add PKFare to the NestJS backend as a **dormant side-provider** and later cut over to it,
without breaking the working Duffel flow. Read [api-reference.md](./api-reference.md) for the
verified API facts and [duffel-coupling-and-gaps.md](./duffel-coupling-and-gaps.md) for the
coupling points and semantic gaps this plan resolves.

**Model:** ports & adapters + a single global selector. Exactly one provider is active, chosen by
`FLIGHT_PROVIDER` (default `duffel`). The work is phased so each phase is independently safe.

---

## Phase 1 — Provider abstraction (pure refactor, zero behavior change)

Goal: nothing outside one module knows which supplier is active. Duffel stays the only real
implementation, so the **existing test suite is the correctness gate**.

**New files (`app/Backend/src/flights/provider/`):**

- `flight-provider.interface.ts` — the port + shared DTOs. **Promote** `NormalizedOffer`,
  `NormalizedSlice`, `NormalizedSegment`, `NormalizedConditions`, `CreateOrderParams`, etc. out of
  `duffel/duffel.service.ts` into here so neither adapter owns the canonical shape.

  ```ts
  export const FLIGHT_PROVIDER = Symbol('FLIGHT_PROVIDER');

  export interface FlightProvider {
    readonly supplier: Supplier;
    isConfigured(): boolean;
    assertConfigured(): void;
    search(params: FlightSearchParams): Promise<NormalizedOffer[]>;
    fetchOffer(offerId: string): Promise<NormalizedOffer>;
    searchAirports(query: string): Promise<AirportSuggestion[]>;
    createOrder(params: CreateOrderParams): Promise<ProviderOrderResult>;
    getOrderStatus(booking: Booking): Promise<ProviderOrderStatus>;
    cancelOrder(orderRef: string): Promise<{ refundAmount: number }>;
    getMetrics(): Promise<ProviderMetrics>;
    supportsWebhooks(): boolean;
    verifyWebhookSignature?(rawBody: Buffer | string, sig?: string): boolean;
  }
  ```

  - `ProviderOrderResult` gets `status: 'confirmed' | 'pending_ticketing'` (Gap 1).
  - Rename `DuffelDefinitiveError` / `DuffelAmbiguousError` → `ProviderDefinitiveError` /
    `ProviderAmbiguousError` (re-export the old names from `duffel.service.ts` for a clean move).

- `flight-provider.module.ts` — binds the token from `FLIGHT_PROVIDER` env:

  ```ts
  {
    provide: FLIGHT_PROVIDER,
    inject: [ConfigService, DuffelService, /* Phase 2: */ PkfareService],
    useFactory: (cfg, duffel /*, pkfare */) =>
      cfg.get('FLIGHT_PROVIDER') === 'pkfare' ? pkfare : duffel,
  }
  ```

**Edits:**

- `duffel/duffel.service.ts` → `implements FlightProvider`; add `supplier = Supplier.Duffel`,
  `supportsWebhooks() => true`, and `getOrderStatus()` (wrap the existing `listOrders` + metadata
  match, extracted from `DuffelReconciliationService`).
- The **7 call sites** (see coupling doc) → inject
  `@Inject(FLIGHT_PROVIDER) private readonly provider: FlightProvider` instead of `DuffelService`;
  swap module `imports` `DuffelModule` → `FlightProviderModule`.
- `bookings/services/duffel-reconciliation.service.ts` → rename
  `order-reconciliation.service.ts`; sweep calls `provider.getOrderStatus(booking)`. Behavior for
  Duffel is unchanged.
- Rate-limit key `duffel_rate_limit:search` → `flight_provider:rate_limit:search` (both services).
- Repoint the affected `.spec.ts` mocks from `DuffelService` to the `FLIGHT_PROVIDER` token.

**Done when:** `cd app/Backend && npm run lint && npm test` is green with `FLIGHT_PROVIDER` unset.

---

## Phase 2 — PKFare adapter (full, dormant)

**New module `app/Backend/src/pkfare/`:**

- `pkfare.module.ts` — exports `PkfareService`.
- `pkfare.service.ts` — `implements FlightProvider`, `supplier = Supplier.Pkfare`,
  `supportsWebhooks() => true`. Reads `PKFARE_PARTNER_ID`, `PKFARE_PARTNER_KEY`,
  `PKFARE_API_BASE` (default `https://api.pkfare.com`); `isConfigured()` gates on partner id/key.
  Methods (verified endpoints):
  - `search()` → `POST /json/shoppingV9`; join `solutions→journeys→flights→segments` →
    `NormalizedOffer[]` (opaque `solutionId` becomes `offer_id`; sum per-pax fares/taxes;
    `miniRuleMap`→`conditions`; synthesize a conservative `expires_at`, Gap 2).
  - `fetchOffer()` → `POST /json/precisePricing_V11` (re-price the `solutionId`); optional
    `penaltyV3` for full fare rules.
  - `createOrder()` → `preciseBooking_V7` (→ `orderNum`, `TO_BE_PAID`) → `orderPricingV5`
    (final-price guard) → `ticketing`/`requestTicketing` (wallet pay + issue). Return
    `{ status: 'pending_ticketing', orderId: orderNum }`. Store `orderNum` in `supplierOrderId`
    immediately (Gap 7). Map errors: `P0xx`/`RSV_FAIL`/insufficient-balance →
    `ProviderDefinitiveError`; `B024`/network → `ProviderAmbiguousError`.
  - `getOrderStatus()` → `POST /json/orderDetail/v13`; map `ISSED`→confirmed (+`ticketNum`/`airPnr`
    documents), `TO_BE_PAID`/`ISS_PRC`→pending, `RSV_FAIL`/`CNCL_*`→failed.
  - `cancelOrder()` → `POST /json/cancel` (pre-ticket) or Refund APIs (post-ticket, async — Gap 5).
  - `searchAirports()` → local IATA list (Gap 3).
  - `getMetrics()` → Redis sliding window keyed `pkfare:metrics:*` (+ low-wallet signal, Gap 4).
  - `verifyWebhookSignature()` → `TicketIssuanceNotify_V2` inbound check
    (`TODO(pkfare-verify)`: scheme; interim IP allowlist + `orderNum` existence).
- `pkfare-signature.util.ts` — `sign = md5(partnerId + partnerKey)` (static, cached) + `fetch`
  wrapper: `POST /json/*`, JSON body, parse in-body `errorCode` (`"0"`=ok), timeouts mirroring
  Duffel (30 s search, 130 s book/ticket).
- `pkfare-offer.mapper.ts` / `pkfare-order.mapper.ts` — PKFare JSON ↔ `NormalizedOffer` /
  `ProviderOrderResult`. Residual `TODO(pkfare-verify)` only where the public doc is silent
  (exact `preciseBooking`/`ticketing` request schemas).
- `pkfare.service.spec.ts` — unit tests against the apidoc's own example JSON (recorded fixtures,
  no live calls).

**Migration** `app/Backend/src/database/migrations/*-AddPkfareSupplier.ts` —
`ALTER TYPE supplier_provider ADD VALUE 'pkfare'` (idempotent guard). Add `Pkfare = 'pkfare'` to
the `Supplier` enum in `bookings/entities/booking.entity.ts`.

**Wire** `PkfareModule` + `PkfareService` into the `FlightProviderModule` factory (the commented
slot from Phase 1).

**Done when:** boot with `FLIGHT_PROVIDER=pkfare` **unconfigured** → `search` returns the standard
`SUPPLIER_UNAVAILABLE` envelope (dormant, no crash); `pkfare.service.spec.ts` green.

---

## Phase 3 — Async-ticketing confirmation (push + poll)

- **Poll path:** `order-reconciliation.service.ts` already calls `provider.getOrderStatus()`.
  Confirm it advances PKFare `paid`→`confirmed` on `ISSED` (writing ticket-number `Document` rows
  via the shared `confirmBookingFromOrder`) and `paid`→`order_failed`+refund on
  `RSV_FAIL`/`CNCL_*`. Tighten the sweep interval when `FLIGHT_PROVIDER=pkfare` (poll from booking
  time — PKFare has no 15-minute "ambiguous" convention).
- **Push path:** generalize `DuffelWebhooksController` into a supplier-scoped controller. Keep
  `POST /webhooks/duffel`; add `POST /webhooks/pkfare` that persists a `SupplierWebhookEvent`
  (`supplier=pkfare`, `supplierResourceId=orderNum`, `eventType=informType`) and enqueues
  processing — reusing the same dedupe / sweep / `confirmBookingFromOrder` path. Each supplier's
  endpoint 404s when it isn't the active provider, so a stray post-cutover delivery can't mutate
  state.

**Done when:** with `FLIGHT_PROVIDER=pkfare` (sandbox), a booking driven to `ISSED` (via a real
issuance or the `buyer/fake/modifyOrder` sandbox helper) reaches `confirmed` with ticket documents.

---

## Phase 4 — Env + cutover docs

- `.env.example` — add a "Flight provider selection" block:

  ```bash
  FLIGHT_PROVIDER=duffel            # duffel | pkfare
  PKFARE_API_BASE=https://api.pkfare.com
  PKFARE_PARTNER_ID=
  PKFARE_PARTNER_KEY=
  ```

- Register the `TicketIssuanceNotify_V2` push URL
  (`https://api.safariyat.live/api/v1/webhooks/pkfare`) with the PKFare account manager.
- Cutover, disable-Duffel, and rollback steps live in [switch-runbook.md](./switch-runbook.md).

---

## State-machine mapping (reference)

| PKFare order status | Event | TravelHub transition |
|---|---|---|
| `TO_BE_PAID` / `ISS_PRC` | after book / ticketing | stay `paid` |
| `ISSED` | push or poll | `paid → confirmed` (T5) + documents |
| `RSV_FAIL`, `CNCL`, `CNCL_*` | poll/push | `paid → order_failed` (T6) + auto-refund |
| `REFD_REIMED` | poll | settle pending supplier-refund ledger entry |

The customer payment (Paymob), booking state machine, ledger, and refund queue are **unchanged** —
PKFare specifics live entirely in the adapter and the reconciliation sweep.
