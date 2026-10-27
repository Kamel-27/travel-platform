# Review — money paths (payments, fulfillment, refunds) and request identity

**Reviewed:** `main` @ `b176f47` (after PRs #41–#43), 2026-10-27
**Scope:** `app/Backend/src/payments/**`, `bookings/services/{expiry-sweep,refund-execution,fulfillment-outcome,duffel-reconciliation}.service.ts`, `bookings/queues/**`, `bookings/bookings.controller.ts`, `main.ts`, `Caddyfile`
**Method:** read against [booking_state_machine.md](../booking_state_machine.md), [sequence_diagrams.md](../sequence_diagrams.md) and [nfr.md](../nfr.md); for every finding the code was read a second time to confirm the failure path exists as described. Severity is about money and customer outcome, not code style.

Findings are ranked. Each has the evidence, the concrete scenario, the fix I would make, and the test that would have caught it.

---

## F1 — HIGH — Every per-IP rate limit is a global limit

**Evidence.** `main.ts` never calls `app.set('trust proxy', …)`. The `Caddyfile` is a bare `reverse_proxy backend:3001`, so every request reaches Express from Caddy's container address. `req.ip` is read in `auth/auth.controller.ts:153` (magic-link per-IP cap), `flights/flights.controller.ts:49` (search inbound limit), `auth/services/token.service.ts:196` (`refresh_tokens.ip`), and `ThrottlerGuard` (`app.module.ts:93`) uses the same value as its tracker.

**Scenario.** One visitor requests 10 magic links in 15 minutes. Every other visitor on the site is now rejected with `429` for the rest of the window, because they all share the proxy's IP. The 100/min global throttle is likewise exhausted by the whole site together. `refresh_tokens.ip` holds the proxy address for every row, so it is useless for abuse review.

**Fix.** In `main.ts`, after `NestFactory.create`: `app.getHttpAdapter().getInstance().set('trust proxy', 1)` (trust exactly one hop, which is Caddy; Caddy sets `X-Forwarded-For` by default). Gate it on an env var defaulting to `1` in production and `0` in dev so a local run without a proxy cannot be spoofed.

**Test.** An e2e spec that sends two requests with different `X-Forwarded-For` values and asserts they are throttled independently; today they share a bucket.

---

## F2 — HIGH — A payment that lands after the booking left `awaiting_payment` is captured, never refunded, and poisons the webhook sweep forever

**Evidence.** `payments/queues/payment-webhook.processor.ts:143-180` locks the booking and goes straight to `stateMachine.transitionTo(…, BookingStatus.Paid)` without looking at the current status. `bookings/services/expiry-sweep.service.ts:29-59` moves every `awaiting_payment` booking with an expired snapshot to `failed` every minute, with no check for a `PaymentAttempt` in `requires_action`. `BookingStateMachineService` throws `409 ILLEGAL_TRANSITION` for `failed → paid` and `confirmed → paid`. The processor has no catch for that, so the job fails with `processed_at` still null, and `PaymentWebhookSweepService` re-enqueues the event every minute.

**Scenario A (expiry race).** The customer opens the Paymob iframe two minutes before the offer expires and completes the card flow after it. The sweep has already moved the booking to `failed`. Paymob's `transaction.succeeded` arrives: money captured, booking `failed`, `Payment` stays `pending`. Admin `POST /admin/payments/:id/refund` is refused because `createPendingRefund` requires `Payment` in `succeeded`. The event is retried every minute until someone deletes the row. The customer has paid for nothing and nobody is told.

**Scenario B (double attempt).** The customer opens two payment intents (two tabs; both are `requires_action`) and pays both. The first confirms the booking. The second `transaction.succeeded` hits a `confirmed` booking and loops the same way; the second charge is never refunded.

**Fix.** In the processor, before T4: if the booking is already `paid`/`confirmed`, or is in any state from which `paid` is illegal, record the attempt as `succeeded`, create a `pending` `Refund` for the full captured amount (reason `payment_after_terminal_state` / `duplicate_payment`), mark the event processed, enqueue the refund, and log at error level so Sentry raises it. That needs `createPendingRefund` to accept a payment whose `Payment` row is still `pending` when the attempt itself succeeded, or a dedicated path that first marks the `Payment` `succeeded`. Separately, the expiry sweep should skip bookings with an attempt in `requires_action` younger than the Paymob session lifetime, and let the next sweep pick them up.

**Test.** Processor spec: succeeded webhook for a `failed` booking → event processed, refund row pending, no throw. Processor spec: second succeeded webhook for a `confirmed` booking → same. Expiry-sweep spec: booking with a fresh `requires_action` attempt is left alone.

---

## F3 — HIGH — Refunds stop working for any booking paid more than 90 days ago

**Evidence.** `bookings/services/refund-execution.service.ts:287-306` (`resolvePaymobTransactionId`) finds the Paymob transaction id only by reading the stored `transaction.succeeded` row in `payment_webhook_events`. `payments/services/webhook-retention.service.ts:24-30` deletes every *processed* event older than 90 days, with no exception for that event type. `PaymentAttempt.provider_reference_id` holds the Paymob **order** id, which the refund API does not accept.

**Scenario.** A customer books in March for an August flight, cancels in July. The refund job throws `No succeeded gateway transaction found for this payment; cannot refund`, retries five times, marks the refund `failed`. Admin retry fails the same way. The only recovery is a manual refund in the Paymob dashboard that the ledger never sees.

**Fix.** Persist the Paymob transaction id at the moment of success: add `provider_transaction_id` to `payment_attempts` (migration), set it in the webhook processor from `obj.id`, and have `resolvePaymobTransactionId` read the attempt first and fall back to the event only for rows created before the migration. Also exclude `transaction.succeeded` events from retention; they are the audit trail for money in.

**Test.** Refund-execution spec: attempt with `provider_transaction_id` set and no webhook row → refund executes. Retention spec: a 100-day-old `transaction.succeeded` row survives the prune.

---

## F4 — HIGH — A refund can be issued twice at the gateway

**Evidence.** `refund-execution.service.ts:173` calls `paymobService.refundTransaction` outside any transaction, then opens the recording transaction at `:176`. `payments/services/paymob.service.ts:259-278` sends `transaction_id` + `amount_cents` with no idempotency key. If the recording transaction fails (Postgres restart, lock timeout, Redis outage after Paymob returned), the row stays `pending`. The processor rethrows, BullMQ retries up to five times with backoff, and `RefundRequeueSweepService` re-enqueues any `pending` row older than five minutes. Each retry calls Paymob again.

**Scenario.** Paymob returns refund id `R1` for 24,544 EGP. The database connection drops before `:176` commits. Thirty seconds later the retry issues a second refund of 24,544 EGP. The customer is refunded twice; the ledger shows one.

**Fix.** Two-phase marker before the gateway call: in a short transaction set `refund.status = 'executing'` (new enum value, migration) with `gateway_attempted_at`, commit, then call Paymob, then record. On any entry with status `executing`, do **not** call the gateway again: log at error level for manual verification and leave it for admin (`POST /admin/refunds/:id/retry` can reset it only after a human checked Paymob). The requeue sweep must ignore `executing` rows.

**Test.** Refund-execution spec: `refundTransaction` resolves, the recording step throws, a second `executeRefund` call does **not** call `refundTransaction` again and the row is `executing`.

---

## F5 — MEDIUM — Permanent webhook failures loop forever instead of parking

**Evidence.** `payment-webhook.processor.ts:171-176` throws on an amount mismatch; `:124-131` throws when the attempt is not found. Both are correct for the transient case (webhook beat the intent row) but there is no bound. `duffel-webhook.processor.ts:124-137` has the same shape for `order.created` events whose order carries no `supplier_idempotency_key` (orders created outside this platform): never resolvable, re-enqueued every minute, each run calling `getOrder`.

**Fix.** Give events an `attempt_count` (or reuse `received_at` age): after N sweeps or 24 h, set `processed_at` with a `failure_reason`, log at error level. Admin can list parked events. This also contains F2 until F2 is fixed.

**Test.** Sweep spec: an event older than the cap is parked, not re-enqueued.

---

## F6 — MEDIUM — Cancellation checks `confirmed` without a lock before calling Duffel

**Evidence.** `bookings/services/bookings.service.ts:707` and `admin/admin.service.ts` (cancel path) read the booking without `pessimistic_write`, call `DuffelService.cancelOrder` (quote + confirm) outside any transaction, then `transitionTo(cancelled)` inside one. Two concurrent cancels (user and admin, or a double click past the frontend guard) both pass the status check, both call Duffel; the second `transitionTo` is a no-op on `cancelled`, so the second caller writes **no** refund row but Duffel may have been asked twice.

**Fix.** Take the row lock and the status check in a transaction, write a `cancellation_in_progress_at` marker, commit, then call Duffel. Or simply rely on Duffel's 4xx for the second cancel and swallow it; but then make the second caller return the existing result rather than a 500.

**Test.** Service spec: two concurrent `cancelBooking` calls → one Duffel call, one refund row.

---

## F7 — LOW — `Idempotency-Key` is global, not per user

**Evidence.** `bookings/bookings.controller.ts:48` keys Redis on the raw header. Replay goes through `getBookingDetail`, which enforces ownership (`bookings.service.ts:598`), so there is no data leak; a cross-user key collision returns 403 instead of creating the booking.

**Fix.** Key on `idempotency_booking:${user.sub}:${key}`.

---

## F8 — LOW — Stripe residue that can mislabel money

`PaymentProvider.Stripe` is still the column default on `payments.provider` (`payments/entities/payment.entity.ts:46`), `stripe` is an unused runtime dependency, and `PUT /bookings/:id/passengers` returns a fake `client_secret`. A `Payment` row created by any future path that forgets to set `provider` is recorded as Stripe. **Fix:** migration to set the default to `paymob`, drop the dependency, drop the fake field from the response and the contract.

---

## Observations not turned into findings

- `transaction.failed` leaves the booking in `awaiting_payment` with no customer-facing signal beyond the attempt row; the web payment page polls booking status, so a decline looks like "still processing" until the user retries. Product gap, covered by the B1b plan.
- `toPaymobGatewayAmount` converts non-EGP with fixed sandbox rates and is bypassed under Jest. The B2 pricing-engine plan replaces it; until then no non-EGP booking should be accepted in production.
- Migrations `1752…`, `1753…`, `1758…` default ids to `uuid_generate_v4()` while every other table uses `gen_random_uuid()`. Nothing in the repo creates the `uuid-ossp` extension; it works because TypeORM runs `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` on connect when an entity has a uuid primary key (`installExtensions` defaults to true, `PostgresDriver.js:323-362`). On a managed Postgres where the app role lacks that privilege, TypeORM only logs a warning and those three migrations fail. Switching the three defaults to `gen_random_uuid()` removes the dependency.
- Crons and workers run inside the single API process; fine with one replica, a double-run trap if ever scaled.

## Suggested order

F1 and F7 are one-line changes. F3 and F8 are a migration plus a few lines. F2 and F4 change behaviour and need the new tests before the code. F5 and F6 can follow.
