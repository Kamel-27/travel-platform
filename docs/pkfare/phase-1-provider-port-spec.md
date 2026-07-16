# Phase 1 Spec — `refactor/flight-provider-port` (standalone, executable)

**Branch:** `refactor/flight-provider-port` · **Type:** pure refactor, **zero behavior change** ·
**Provider:** Duffel stays the only implementation and the default · **Gate:** the existing backend
test suite must stay green (`npm test`), plus `lint:check`, `typecheck`, `build`.

This spec is self-contained — you do **not** need PKFare credentials or any PKFare code for Phase 1.
It introduces the provider abstraction so a later branch (`feat/pkfare-adapter`) can drop in a
second supplier by adding one file and flipping one env var. Read
[implementer-handover.md](./implementer-handover.md) first for house conventions; read
[architecture.md](./architecture.md) §2 for the target interface.

> **Guardrail:** if any step changes observable behavior for Duffel (a test needs new assertions,
> not just a moved mock token), you've gone too far — stop and re-read. The only intended runtime
> change is that `Booking.supplier`/`FlightOfferSnapshot.supplier` are set from
> `provider.supplier` instead of a hardcoded `Supplier.Duffel` (identical value for Duffel).

---

## 0. The decision that shapes everything: token vs. direct

Two kinds of consumer of `DuffelService` today. They are treated differently:

| Consumer | Phase 1 treatment | Why |
|---|---|---|
| `flights/flights.service.ts` | inject **`FLIGHT_PROVIDER` token** | provider-agnostic |
| `bookings/services/bookings.service.ts` | inject **token** | provider-agnostic |
| `bookings/services/order-fulfillment.service.ts` | inject **token** | provider-agnostic |
| `bookings/services/duffel-reconciliation.service.ts` → renamed | inject **token** | provider-agnostic |
| `admin/services/admin.service.ts` | inject **token** | provider-agnostic |
| `bookings/duffel-webhooks.controller.ts` | **keep injecting `DuffelService` directly** | webhook ingest is Duffel-specific |
| `bookings/queues/duffel-webhook.processor.ts` | **keep injecting `DuffelService` directly** | Duffel-specific (`getOrder`, schedule-change diff) |

So **5 sites move to the token; 2 Duffel-webhook components stay on `DuffelService`.** The port
therefore does **not** need Duffel-only methods (`getOrder`, `listOrders`, `verifyWebhookSignature`
stay public on `DuffelService` for the webhook components and for `getOrderStatus` internal use).

---

## 1. New file — `src/flights/provider/flight-provider.interface.ts`

Promote the canonical DTOs here (moved out of `duffel.service.ts`) and define the port. Exact code:

```ts
import type { Booking, Supplier } from '../../bookings/entities/booking.entity';

export const FLIGHT_PROVIDER = Symbol('FLIGHT_PROVIDER');

// ── Money & offer DTOs (moved verbatim from duffel.service.ts) ──
export interface MinorUnitMoney { amount: number; currency: string; }
export interface NormalizedSegment {
  marketing_carrier: string; operating_carrier: string; flight_number: string;
  departing_at: { local: string; timezone: string };
  arriving_at: { local: string; timezone: string };
  origin_terminal: string | null; destination_terminal: string | null;
}
export interface NormalizedSlice { origin: string; destination: string; duration: string; segments: NormalizedSegment[]; }
export interface NormalizedCondition { allowed: boolean; penalty: MinorUnitMoney | null; }
export interface NormalizedConditions { refund_before_departure?: NormalizedCondition; change_before_departure?: NormalizedCondition; }
export interface NormalizedOffer {
  offer_id: string; expires_at: string; total: MinorUnitMoney;
  airline: { name: string; iata: string; logo_url: string };
  cabin_class: string; passenger_identity_documents_required: boolean;
  slices: NormalizedSlice[]; conditions: NormalizedConditions;
  passengers: { id: string; type: string }[];
}

// ── Params ──
export interface FlightSearchParams {
  origin: string; destination: string; departureDate: string; returnDate?: string;
  passengers: { type: string }[]; cabinClass?: string;
}
export interface CreateOrderPassenger {           // moved from duffel.service.ts (kept as the neutral pax DTO)
  id: string; given_name: string; family_name: string; title: string; gender: string;
  born_on: string; email: string; phone_number: string; infant_passenger_id?: string;
  identity_documents?: { type: string; unique_identifier: string; expires_on: string; issuing_country_code: string }[];
}
export interface CreateOrderParams {
  offerId: string; passengers: CreateOrderPassenger[]; metadata: Record<string, string>;
  amount: number; currency: string;
}
export interface AirportSuggestion { code: string; city: string; country: string; type: string; name: string; }

// ── Results ──
export interface ProviderDocument { type: string; uniqueIdentifier: string; passengerIds: string[]; }
export interface ProviderOrderResult {
  status: 'confirmed' | 'pending_ticketing';   // Duffel → always 'confirmed'
  orderId: string; bookingReference: string | null; documents: ProviderDocument[];
}
export interface ProviderOrderStatus {
  state: 'confirmed' | 'pending' | 'failed' | 'absent';
  orderId: string | null; bookingReference: string | null;
  documents: ProviderDocument[]; raw: Record<string, unknown>;
}
export interface ProviderMetrics {
  configured: boolean; requestsLastHour: number; errorsLastHour: number;
  recentErrorRate: number; walletBalanceLow?: boolean;
}

// ── Neutral errors (rename of DuffelDefinitiveError / DuffelAmbiguousError) ──
export class ProviderDefinitiveError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); this.name = 'ProviderDefinitiveError'; }
}
export class ProviderAmbiguousError extends Error {
  constructor(message: string, public readonly requestId?: string) { super(message); this.name = 'ProviderAmbiguousError'; }
}

// ── The port ──
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

> `AirportSuggestion` and `ProviderMetrics` replace the `any[]` / inline return types Duffel used —
> `duffel.service.ts.searchAirports` already returns exactly this shape, and `getMetrics` already
> returns exactly `ProviderMetrics`. No logic changes, just a named type.

---

## 2. New file — `src/flights/provider/flight-provider.module.ts`

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DuffelModule } from '../../duffel/duffel.module';
import { DuffelService } from '../../duffel/duffel.service';
import { FLIGHT_PROVIDER, FlightProvider } from './flight-provider.interface';

@Module({
  imports: [DuffelModule],
  providers: [
    {
      provide: FLIGHT_PROVIDER,
      inject: [ConfigService, DuffelService],
      useFactory: (cfg: ConfigService, duffel: DuffelService): FlightProvider => {
        const selected = cfg.get<string>('FLIGHT_PROVIDER') ?? 'duffel';
        if (selected === 'pkfare') {
          // Phase 2 wires PkfareService here. Until then, fail loudly rather than
          // silently serving Duffel under a pkfare flag.
          throw new Error('FLIGHT_PROVIDER=pkfare but the PKFare adapter is not implemented yet (Phase 2).');
        }
        return duffel;
      },
    },
  ],
  exports: [FLIGHT_PROVIDER],
})
export class FlightProviderModule {}
```

---

## 3. `src/duffel/duffel.service.ts` — implement the port

1. **Import the DTOs from the interface** and delete their local declarations; **re-export** them
   so existing `import { NormalizedOffer } from '../duffel/duffel.service'` lines elsewhere keep
   compiling without edits:
   ```ts
   export {
     NormalizedOffer, NormalizedSlice, NormalizedSegment, NormalizedConditions, NormalizedCondition,
     MinorUnitMoney, CreateOrderParams, CreateOrderPassenger, ProviderDocument, ProviderOrderResult,
     ProviderOrderStatus, ProviderMetrics, ProviderDefinitiveError, ProviderAmbiguousError,
   } from '../flights/provider/flight-provider.interface';
   // Back-compat aliases so order-fulfillment's existing imports/catches still resolve:
   export { ProviderDefinitiveError as DuffelDefinitiveError, ProviderAmbiguousError as DuffelAmbiguousError } from '../flights/provider/flight-provider.interface';
   ```
   (Interim: keep the aliases so you can migrate `order-fulfillment` in step 4 without a flag day.)
2. **Class declaration:** `export class DuffelService implements FlightProvider {`
3. **Add** `readonly supplier = Supplier.Duffel;` and `supportsWebhooks(): boolean { return true; }`
   (import `Supplier` from the booking entity).
4. **`createOrder`** — its current success return builds `{ orderId, bookingReference, documents }`.
   Change `mapOrderResult` (or the return) to prepend `status: 'confirmed' as const`. Throw the
   **neutral** errors (`ProviderDefinitiveError` / `ProviderAmbiguousError`) — they're the same
   classes, now imported from the interface. No control-flow change.
5. **Add `getOrderStatus`** by moving the list-orders-and-match logic out of the reconciliation
   service (step 6). `listOrders` stays a public method on this class:
   ```ts
   async getOrderStatus(booking: Booking): Promise<ProviderOrderStatus> {
     const orders = await this.listOrders({ createdAfter: booking.createdAt.toISOString(), limit: 200 });
     const match = orders.find((o) => {
       const md = o['metadata'] as Record<string, string> | undefined;
       return md?.['supplier_idempotency_key'] === booking.supplierIdempotencyKey;
     });
     if (!match) return { state: 'absent', orderId: null, bookingReference: null, documents: [], raw: {} };
     return {
       state: 'confirmed',
       orderId: match['id'] as string,
       bookingReference: (match['booking_reference'] as string) ?? null,
       documents: [], // reconciliation writes documents from `raw`; see step 6
       raw: match,
     };
   }
   ```
   `searchAirports` return type → `Promise<AirportSuggestion[]>` (shape already matches).
   `getMetrics` return type → `Promise<ProviderMetrics>` (shape already matches).

---

## 4. Repoint the 5 provider-agnostic consumers

For each: change the constructor param from
`private readonly duffelService: DuffelService` to
`@Inject(FLIGHT_PROVIDER) private readonly provider: FlightProvider`, add the imports
(`Inject` from `@nestjs/common`; `FLIGHT_PROVIDER`, `FlightProvider` from the interface), and
replace `this.duffelService.` with `this.provider.`. Specifics:

- **`flights/flights.service.ts`** — `search`, `fetchOffer`, `searchAirports` now via `this.provider`.
  Also rename the field `outboundBucketKey = 'duffel_rate_limit:search'` →
  `'flight_provider:rate_limit:search'` (see step 7).
- **`bookings/services/bookings.service.ts`** — `fetchOffer`, `cancelOrder` via `this.provider`.
  Replace the two hardcoded `newBooking.supplier = Supplier.Duffel;` /
  `snapshot.supplier = Supplier.Duffel;` with `this.provider.supplier`. Rename its
  `outboundBucketKey` the same as above (they share the Redis key — keep them identical).
- **`bookings/services/order-fulfillment.service.ts`** — `createOrder` via `this.provider`. Import
  `ProviderDefinitiveError`/`ProviderAmbiguousError`/`CreateOrderPassenger` from the interface (drop
  the Duffel-named imports). In `fulfillOrder`, guard the success path on the discriminator:
  ```ts
  const result = await this.provider.createOrder({ /* unchanged args */ });
  if (result.status === 'confirmed') {
    await this.handleOrderSuccess(booking, result);
  } else {
    // pending_ticketing → leave in `paid`; reconciliation/webhook confirms later (PKFare path)
    this.logger.log(`Booking ${booking.id} pending ticketing (order ${result.orderId}); awaiting confirmation.`);
    await this.entityManager.getRepository(Booking).update(booking.id, { supplierOrderId: result.orderId });
  }
  ```
  (For Duffel `status` is always `'confirmed'`, so this is behavior-preserving.)
- **`admin/services/admin.service.ts`** — `cancelOrder`, `getMetrics` via `this.provider`. Keep the
  method name `getDuffelHealth` and the `/admin/health/duffel` route and `{ duffel: … }` response
  shape unchanged (contract fidelity — `api_contract.md`). Only the injected dependency changes.
- **`bookings/services/order-reconciliation.service.ts`** — see step 6.

**Do NOT touch** `duffel-webhooks.controller.ts` or `duffel-webhook.processor.ts` beyond the
reconciliation import rename (step 6) — they keep injecting `DuffelService` directly.

---

## 5. Rename the reconciliation service (file + class)

`bookings/services/duffel-reconciliation.service.ts` → `order-reconciliation.service.ts`; class
`DuffelReconciliationService` → `OrderReconciliationService`. Inject the token. Replace the
`listOrders`-and-match body of `reconcileBooking` with a call to `provider.getOrderStatus`:

```ts
private async reconcileBooking(booking: Booking): Promise<void> {
  const status = await this.provider.getOrderStatus(booking);
  if (status.state === 'confirmed') {
    await this.entityManager.transaction((m) =>
      this.confirmBookingFromOrder(m, booking, status.raw, 'Reconciliation sweep found order'));
  } else {
    await this.handleVerifiedAbsent(booking);   // unchanged
  }
}
```

Keep `confirmBookingFromOrder(manager, booking, order, reason?)` **exactly as-is** — it already
reads `order['id']`, `order['booking_reference']`, `order['documents']` from the raw Duffel order,
and `status.raw` is that same object. `handleOrderFound` becomes unused — delete it. The 15-minute
staleness gate stays in `sweepStuckPaidBookings` (unchanged), so returning `'absent'` is only ever
acted on for genuinely stuck bookings, preserving today's behavior.

Update the import + injected type in **`duffel-webhook.processor.ts`**
(`DuffelReconciliationService` → `OrderReconciliationService`, new path). The processor still
injects `DuffelService` directly for `getOrder`.

---

## 6. Rate-limit key rename

`flights.service.ts` and `bookings.service.ts` both define
`outboundBucketKey = 'duffel_rate_limit:search'`. Change **both** to
`'flight_provider:rate_limit:search'` (they must stay identical — it's a shared Redis token
bucket). Cosmetic; no behavior change. (Optional: leave the old key if you'd rather not risk a
window of double-capacity on deploy — but renaming both atomically is fine.)

---

## 7. Module wiring

- **`flights/flights.module.ts`** — replace `imports: [DuffelModule]` with `[FlightProviderModule]`.
- **`bookings/bookings.module.ts`** — keep `DuffelModule` (the webhook processor/controller need
  `DuffelService`) **and add** `FlightProviderModule`. Update the provider list:
  `DuffelReconciliationService` → `OrderReconciliationService` (and its import path).
- **`admin/admin.module.ts`** — replace `DuffelModule` with `FlightProviderModule` (admin.service
  now only uses the token).

`FlightProviderModule` imports `DuffelModule` and exports the `FLIGHT_PROVIDER` token, so any module
that imports `FlightProviderModule` can inject the token.

---

## 8. Update the affected `.spec.ts` files

Mechanical: wherever a test registers `{ provide: DuffelService, useValue: mock }` for a
**token-consuming** service, change it to `{ provide: FLIGHT_PROVIDER, useValue: mock }` and import
the token. Files:

- `flights.service.spec.ts`, `bookings.service.spec.ts`, `admin.service.spec.ts`,
  `order-fulfillment.service.spec.ts` — swap the provider token on the mock.
- `order-fulfillment.service.spec.ts` — the `createOrder` mock must now resolve
  `{ status: 'confirmed', orderId, bookingReference, documents }` (add `status: 'confirmed'`).
- `duffel-reconciliation.service.spec.ts` → rename to `order-reconciliation.service.spec.ts`; the
  mock provider now needs `getOrderStatus` instead of `listOrders`
  (`getOrderStatus: jest.fn().mockResolvedValue({ state: 'confirmed', raw: fakeOrder, … })` for the
  found case, `{ state: 'absent', raw: {} }` for the absent case).
- `duffel-webhook.processor.spec.ts`, `duffel-webhooks.controller.spec.ts` — **keep** the
  `DuffelService` mock (still injected directly); only update the reconciliation-service
  import/type name.

---

## 9. Verification (all must pass — this is the gate)

Run in `app/Backend`:

```bash
npm run lint          # auto-fix first
npm run lint:check    # CI gate 1
npm run typecheck     # CI gate 2
npm run build         # CI gate 3
npm test              # CI gate 4 — the real correctness proof
```

All four green with **`FLIGHT_PROVIDER` unset** proves the refactor changed no Duffel behavior.
Then, live-boot sanity:

```bash
docker compose up --wait
npm run migration:run        # (no new migration in Phase 1, but confirm clean)
npm run start:prod           # background; then:
# GET /flights/search?... returns Duffel offers exactly as before
# GET /admin/health/duffel still returns { duffel: { configured, ... } }
```

Confirm the **zero-drift** check still prints "No changes" (no entity changes in Phase 1).

---

## 10. Non-goals (explicitly NOT in this branch)

- No PKFare code, no `Pkfare` enum value, no migration — that's `feat/pkfare-adapter` (Phase 2).
- No `POST /webhooks/pkfare`, no supplier-scoped webhook controller — Phase 3.
- No renaming of the `/admin/health/duffel` route or `duffel:` response key — contract stays.
- No change to the booking state machine, Paymob, ledger, or refund pipeline.

---

## 11. Gotchas (from repo experience — see [implementer-handover.md](./implementer-handover.md))

- **Re-export, don't break imports.** Many files import `NormalizedOffer` etc. *from
  `duffel.service.ts`*. The re-exports in step 3 keep them compiling — verify with `typecheck`
  before touching every import site. (You may migrate imports to the interface path later; not
  required for Phase 1.)
- **Circular imports.** The interface imports `Booking`/`Supplier` as **`import type`** only —
  keep it that way so `flights/provider` ↔ `bookings/entities` stays type-only and doesn't create a
  runtime cycle.
- **DI resolution errors** mean a module didn't import `FlightProviderModule` or didn't export the
  token — check the three modules in step 7.
- **Don't** convert the Duffel webhook components to the token; they legitimately need Duffel-only
  methods, and forcing them onto the port would bloat the interface with `getOrder`/`listOrders`.
- Commit with a detailed body + `Co-Authored-By` trailer; push; hand the user the compare URL
  (`https://github.com/Kamel-27/travel-platform/compare/main...refactor/flight-provider-port?expand=1`)
  — there is no `gh` CLI here.

---

## Definition of done

- [ ] `flight-provider.interface.ts` + `flight-provider.module.ts` created.
- [ ] `DuffelService implements FlightProvider` (+ `supplier`, `supportsWebhooks`, `getOrderStatus`,
      `createOrder` returns `status`), DTOs promoted + re-exported.
- [ ] 5 consumers inject the token; 2 Duffel-webhook components unchanged (except reconciliation
      rename).
- [ ] Reconciliation renamed to `OrderReconciliationService`, uses `getOrderStatus`.
- [ ] Rate-limit key renamed in both services; `bookings.service` sets `supplier` from
      `provider.supplier`.
- [ ] 3 modules rewired; all specs updated.
- [ ] `lint:check` + `typecheck` + `build` + `test` green with `FLIGHT_PROVIDER` unset; zero drift.
