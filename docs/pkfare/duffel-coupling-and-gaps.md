# Duffel Coupling Points & PKFare Gaps to Resolve

Two questions this file answers:

1. **Where is the backend hard-wired to Duffel today?** (what the provider abstraction must hide)
2. **What does PKFare NOT offer that Duffel does — and how do we resolve each gap?**

---

## Part 1 — Current Duffel coupling points

The good news: the **data model is already supplier-agnostic**. There's a `Supplier` enum, and
columns are generically named (`supplierOrderId`, `supplierOfferId`, `supplierIdempotencyKey`,
`supplierPassengerId`), plus a multi-supplier `supplier_webhook_events` table. A normalization
layer (`NormalizedOffer` / `NormalizedSlice` / `NormalizedSegment` / `NormalizedConditions`)
already sits between the supplier and everything else. The coupling is in **wiring**, not schema.

`DuffelService` is injected directly at **7 sites**:

| # | File | Duffel calls used | What the port must expose |
|---|---|---|---|
| 1 | `app/Backend/src/flights/flights.service.ts` | `search`, `fetchOffer`, `searchAirports` | search / re-price / airport lookup |
| 2 | `app/Backend/src/bookings/services/bookings.service.ts` | `fetchOffer`, `cancelOrder` | re-price at booking, cancel |
| 3 | `app/Backend/src/bookings/services/order-fulfillment.service.ts` | `createOrder` + `mapPassengersToDuffel` | create order (returns `confirmed` **or** `pending_ticketing`) |
| 4 | `app/Backend/src/bookings/services/duffel-reconciliation.service.ts` | `listOrders` (+ metadata match) | `getOrderStatus(booking)` |
| 5 | `app/Backend/src/bookings/queues/duffel-webhook.processor.ts` | `getOrder`, schedule-change diff | order lookup + change handling |
| 6 | `app/Backend/src/bookings/duffel-webhooks.controller.ts` | `verifyWebhookSignature` | inbound webhook verify/ingest |
| 7 | `app/Backend/src/admin/services/admin.service.ts` | `getMetrics` | provider health metrics |

Plus non-injection coupling:

- **Rate-limit key** `duffel_rate_limit:search` is shared by `flights.service.ts` and
  `bookings.service.ts` → rename to provider-neutral `flight_provider:rate_limit:search`.
- **Duffel-named errors** `DuffelDefinitiveError` / `DuffelAmbiguousError` are imported by
  `order-fulfillment.service.ts` → promote to `ProviderDefinitiveError` / `ProviderAmbiguousError`.
- **`NormalizedOffer` et al.** are declared *inside* `duffel.service.ts` and imported from there
  by `flights.service.ts`, `flights.controller.ts`, `bookings.service.ts` → promote to the shared
  `flights/provider/flight-provider.interface.ts` so neither adapter owns the canonical shape.
- Each site's `.spec.ts` mocks `DuffelService` → repoint mocks to the `FLIGHT_PROVIDER` token.

**Resolution:** introduce a `FlightProvider` interface + `FLIGHT_PROVIDER` DI token bound by a
selector module (`FLIGHT_PROVIDER` env, default `duffel`). All 7 sites inject the token. This is
a pure refactor — the existing Duffel test suite is the correctness gate. Detail in
[integration-guide.md](./integration-guide.md).

---

## Part 2 — What PKFare does NOT offer (gaps) and how to resolve them

These are the genuine **semantic** differences — the places where a naive "swap the HTTP client"
would break critical logic. Each has a concrete resolution that keeps the booking / payment /
ledger / refund cores intact.

### Gap 1 — No atomic book+pay; ticketing is asynchronous
- **Duffel:** one `POST /air/orders` returns a **confirmed** order with e-ticket documents.
- **PKFare:** `preciseBooking` (→ `TO_BE_PAID`) then `ticketing` (→ `ISS_PRC`); `ISSED` +
  ticket numbers arrive **later** via push/poll.
- **Why it matters:** `OrderFulfillmentService` currently assumes `createOrder()` yields a
  confirmed order synchronously.
- **Resolution:** give `createOrder()`'s result a `status: 'confirmed' | 'pending_ticketing'`
  discriminator. Duffel returns `confirmed`; PKFare returns `pending_ticketing` and the booking
  **stays in `paid`** until the reconciliation sweep or the `POST /webhooks/pkfare` handler sees
  `ISSED` and runs the **existing** `confirmBookingFromOrder` path. This reuses machinery already
  built for Duffel's ambiguous-outcome recovery — no new state.

### Gap 2 — No offer `expires_at`
- **Duffel:** every offer has an authoritative `expires_at` driving cache TTL and the checkout
  countdown (`flights.service.ts` `calculateCacheTtl`, ≤120 s, min of offer expiries).
- **PKFare:** solutions have **no expiry timestamp**; freshness is enforced by re-calling
  `precisePricing` (and `orderPricing`) right before booking.
- **Resolution:** in the PKFare adapter, synthesize a **conservative fixed TTL** (e.g. 60–120 s)
  for `NormalizedOffer.expires_at` so downstream cache/countdown code is unchanged, and rely on
  the mandatory `precisePricing` re-price at booking as the real price guarantee (already how
  `bookings.service.createBooking` works — it re-fetches before creating the booking).

### Gap 3 — No airport-autocomplete endpoint
- **Duffel:** `GET /places/suggestions` powers `GET /flights/airports/search`.
- **PKFare:** no equivalent in the Buyer API; shopping takes IATA codes directly.
- **Resolution:** back `searchAirports()` in the PKFare adapter with a **local IATA dataset**
  (the frontend already ships `app/web/src/lib/airports.ts`; mirror/serve a backend copy). This
  is display-only and touches no booking logic.

### Gap 4 — Prepaid-wallet settlement (new failure mode)
- **Duffel:** payment is part of order creation (instant/pass-through); no standalone "balance".
- **PKFare:** tickets are paid from a **prepaid wallet** (`PREPAY`). **Insufficient balance** is a
  failure with no Duffel analogue.
- **Resolution:** map a wallet/balance failure at `ticketing` to `ProviderDefinitiveError`
  (definitive, order not ticketed) → existing T6 path: `order_failed` + auto-refund to the
  customer. Add a low-balance signal to `getMetrics()`/admin health so ops can top up **before**
  customers hit it. `TODO(pkfare-verify)`: exact insufficient-balance error code.

### Gap 5 — Refund is async and multi-state
- **Duffel:** `cancelOrder` is a 2-step quote+confirm returning the **final** `refund_amount`
  synchronously; `bookings.service.cancelBooking` uses that number immediately.
- **PKFare:** pre-ticket `cancel` may be immediate, but post-ticket refunds go through the Refund
  APIs (`UNDER_REVIEW → REFD_PRC → REFD_TO_BE_REIM → REFD_REIMED`) — the reimbursed amount is
  **not** known at request time.
- **Resolution:** the customer-facing refund already runs through Paymob on
  `refund_execution_queue` and is decoupled from the supplier refund; keep paying the customer per
  policy (`supplier refund + full markup`, `prd.md §5.4`) immediately. For PKFare, record the
  **supplier-side** reimbursement as a **pending ledger entry** that the reconciliation sweep
  settles when the order reaches `*_REIMED`. This keeps the customer experience identical while
  the supplier ledger tolerates the reimbursement window. `TODO(pkfare-verify)`: exact Refund API
  request/response fields.

### Gap 6 — Different post-booking change model
- **Duffel:** `order.airline_initiated_change_detected` webhook → `duffel-webhook.processor.ts`
  diffs segments and emails the customer.
- **PKFare:** separate **Flight schedule change APIs** + `TicketIssuanceNotify_V2`
  (`informType = Ticket_Change`).
- **Resolution:** out of scope for the initial cutover critical path. Track as a follow-up: add a
  PKFare schedule-change branch mirroring the Duffel processor. Confirmation (`ISSED`) and refund
  are the must-haves for go-live; schedule-change parity can follow.

### Gap 7 — Idempotency / duplicate-order protection
- **Duffel:** no server idempotency key; TravelHub echoes `supplierIdempotencyKey` into order
  `metadata` and reconciles via list-orders.
- **PKFare:** dedupe/matching is via your own reference + the returned `orderNum`; `orderDetail`
  is the source of truth.
- **Resolution:** keep the existing pre-flight idempotency guard; on ambiguous `preciseBooking` /
  `ticketing` outcomes, **never blind-retry** — resolve via `orderDetail` poll (mirrors the Duffel
  rule). Store PKFare's `orderNum` in `supplierOrderId` as soon as `preciseBooking` returns it.

---

## Summary

| Concern | Resolution keeps intact |
|---|---|
| Async ticketing (Gap 1) | Reuse `paid`→`confirmed` sweep + webhook table |
| No `expires_at` (Gap 2) | Synthesize TTL; rely on mandatory re-price |
| No airport search (Gap 3) | Local IATA list (display-only) |
| Wallet balance (Gap 4) | Map to definitive failure → existing auto-refund; add health metric |
| Async refund (Gap 5) | Pay customer now; settle supplier ledger on `*_REIMED` |
| Schedule change (Gap 6) | Follow-up; not on go-live critical path |
| Idempotency (Gap 7) | Existing guard + `orderDetail` reconciliation |

None of these require changes to the booking state machine, the Paymob payment flow, the
double-entry ledger, or the customer refund pipeline — they are handled **inside the PKFare
adapter and the (already generalized) reconciliation sweep.**
