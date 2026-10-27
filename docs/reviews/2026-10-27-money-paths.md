# Review — money paths (payments, fulfillment, refunds) and request identity

**Reviewed:** `main` @ `b176f47` (after PRs #41–#43), 2026-10-27
**Pending:** reflects fix branches fix/trust-proxy-and-idempotency-scope, fix/refund-transaction-id, fix/payment-after-terminal-state, fix/refund-executing-marker not yet merged to main.
**Scope:** `app/Backend/src/payments/**`, `bookings/services/{expiry-sweep,refund-execution,fulfillment-outcome,duffel-reconciliation}.service.ts`, `bookings/queues/**`, `bookings/bookings.controller.ts`, `main.ts`, `Caddyfile`
**Method:** read against [booking_state_machine.md](../booking_state_machine.md), [sequence_diagrams.md](../sequence_diagrams.md) and [nfr.md](../nfr.md); for every finding the code was read a second time to confirm the failure path exists as described. Severity is about money and customer outcome, not code style.

Findings are ranked. Each has the evidence, the concrete scenario, the fix I would make, and the test that would have caught it.

---

## F1 — HIGH — Every per-IP rate limit is a global limit

**Status:** Fixed on `fix/trust-proxy-and-idempotency-scope` (commit `cedf9b2`): `configureTrustProxy` in `main.ts`, `TRUST_PROXY_HOPS` defaulting to 1 in production and 0 elsewhere, e2e bootstrap mirrors it. Not yet merged to `main`.

**Evidence.** `main.ts` never calls `app.set('trust proxy', …)`. The `Caddyfile` is a bare `reverse_proxy backend:3001`, so every request reaches Express from Caddy's container address. `req.ip` is read in `auth/auth.controller.ts:153` (magic-link per-IP cap), `flights/flights.controller.ts:49` (search inbound limit), `auth/services/token.service.ts:196` (`refresh_tokens.ip`), and `ThrottlerGuard` (`app.module.ts:93`) uses the same value as its tracker.

**Scenario.** One visitor requests 10 magic links in 15 minutes. Every other visitor on the site is now rejected with `429` for the rest of the window, because they all share the proxy's IP. The 100/min global throttle is likewise exhausted by the whole site together. `refresh_tokens.ip` holds the proxy address for every row, so it is useless for abuse review.

**Fix.** In `main.ts`, after `NestFactory.create`: `app.getHttpAdapter().getInstance().set('trust proxy', 1)` (trust exactly one hop, which is Caddy; Caddy sets `X-Forwarded-For` by default). Gate it on an env var defaulting to `1` in production and `0` in dev so a local run without a proxy cannot be spoofed.

**Test.** An e2e spec that sends two requests with different `X-Forwarded-For` values and asserts they are throttled independently; today they share a bucket.

---

## F2 — HIGH — A payment that lands after the booking left `awaiting_payment` is captured, never refunded, and poisons the webhook sweep forever

**Status:** Fixed on `fix/payment-after-terminal-state` (commit `8a57b18`): both scenarios — A (capture after the sweep failed the booking: recorded, full refund `payment_after_failed`) and B (second attempt on a paid/confirmed booking: attempt-level refund `duplicate_payment` pinned via `refunds.payment_attempt_id`) — plus the sweep grace window (`PAYMENT_IN_FLIGHT_GRACE_MS`, 30 min, for attempts in `requires_action`). Not yet merged to `main`.

**Evidence.** `payments/queues/payment-webhook.processor.ts:143-180` locks the booking and goes straight to `stateMachine.transitionTo(…, BookingStatus.Paid)` without looking at the current status. `bookings/services/expiry-sweep.service.ts:29-59` moves every `awaiting_payment` booking with an expired snapshot to `failed` every minute, with no check for a `PaymentAttempt` in `requires_action`. `BookingStateMachineService` throws `409 ILLEGAL_TRANSITION` for `failed → paid` and `confirmed → paid`. The processor has no catch for that, so the job fails with `processed_at` still null, and `PaymentWebhookSweepService` re-enqueues the event every minute.

**Scenario A (expiry race).** The customer opens the Paymob iframe two minutes before the offer expires and completes the card flow after it. The sweep has already moved the booking to `failed`. Paymob's `transaction.succeeded` arrives: money captured, booking `failed`, `Payment` stays `pending`. Admin `POST /admin/payments/:id/refund` is refused because `createPendingRefund` requires `Payment` in `succeeded`. The event is retried every minute until someone deletes the row. The customer has paid for nothing and nobody is told.

**Scenario B (double attempt).** The customer opens two payment intents (two tabs; both are `requires_action`) and pays both. The first confirms the booking. The second `transaction.succeeded` hits a `confirmed` booking and loops the same way; the second charge is never refunded.

**Fix.** In the processor, before T4: if the booking is already `paid`/`confirmed`, or is in any state from which `paid` is illegal, record the attempt as `succeeded`, create a `pending` `Refund` for the full captured amount (reason `payment_after_terminal_state` / `duplicate_payment`), mark the event processed, enqueue the refund, and log at error level so Sentry raises it. That needs `createPendingRefund` to accept a payment whose `Payment` row is still `pending` when the attempt itself succeeded, or a dedicated path that first marks the `Payment` `succeeded`. Separately, the expiry sweep should skip bookings with an attempt in `requires_action` younger than the Paymob session lifetime, and let the next sweep pick them up.

**Test.** Processor spec: succeeded webhook for a `failed` booking → event processed, refund row pending, no throw. Processor spec: second succeeded webhook for a `confirmed` booking → same. Expiry-sweep spec: booking with a fresh `requires_action` attempt is left alone.

---

## F3 — HIGH — Refunds stop working for any booking paid more than 90 days ago

**Status:** Fixed on `fix/refund-transaction-id` (commit `ff4c630`): `payment_attempts.provider_transaction_id` (migration `1759…`, backfilled from existing webhook rows), refund execution reads it first and falls back to the webhook row, retention never prunes `transaction.succeeded`. Not yet merged to `main`.

**Evidence.** `bookings/services/refund-execution.service.ts:287-306` (`resolvePaymobTransactionId`) finds the Paymob transaction id only by reading the stored `transaction.succeeded` row in `payment_webhook_events`. `payments/services/webhook-retention.service.ts:24-30` deletes every *processed* event older than 90 days, with no exception for that event type. `PaymentAttempt.provider_reference_id` holds the Paymob **order** id, which the refund API does not accept.

**Scenario.** A customer books in March for an August flight, cancels in July. The refund job throws `No succeeded gateway transaction found for this payment; cannot refund`, retries five times, marks the refund `failed`. Admin retry fails the same way. The only recovery is a manual refund in the Paymob dashboard that the ledger never sees.

**Fix.** Persist the Paymob transaction id at the moment of success: add `provider_transaction_id` to `payment_attempts` (migration), set it in the webhook processor from `obj.id`, and have `resolvePaymobTransactionId` read the attempt first and fall back to the event only for rows created before the migration. Also exclude `transaction.succeeded` events from retention; they are the audit trail for money in.

**Test.** Refund-execution spec: attempt with `provider_transaction_id` set and no webhook row → refund executes. Retention spec: a 100-day-old `transaction.succeeded` row survives the prune.

---

## F4 — HIGH — A refund can be issued twice at the gateway

**Status:** Fixed on `fix/refund-executing-marker` (commit `62bc799`): three-phase execution with `executing` + `gateway_attempted_at` (migration `1761…`), `PaymobGatewayError.definitive` (4xx → back to `pending` and retry; network/timeout/5xx → parked in `executing`), requeue sweep leaves `executing` alone, admin retry requires `gateway_checked: true` for such a row. Not yet merged to `main`.

**Evidence.** `refund-execution.service.ts:173` calls `paymobService.refundTransaction` outside any transaction, then opens the recording transaction at `:176`. `payments/services/paymob.service.ts:259-278` sends `transaction_id` + `amount_cents` with no idempotency key. If the recording transaction fails (Postgres restart, lock timeout, Redis outage after Paymob returned), the row stays `pending`. The processor rethrows, BullMQ retries up to five times with backoff, and `RefundRequeueSweepService` re-enqueues any `pending` row older than five minutes. Each retry calls Paymob again.

**Scenario.** Paymob returns refund id `R1` for 24,544 EGP. The database connection drops before `:176` commits. Thirty seconds later the retry issues a second refund of 24,544 EGP. The customer is refunded twice; the ledger shows one.

**Fix.** Two-phase marker before the gateway call: in a short transaction set `refund.status = 'executing'` (new enum value, migration) with `gateway_attempted_at`, commit, then call Paymob, then record. On any entry with status `executing`, do **not** call the gateway again: log at error level for manual verification and leave it for admin (`POST /admin/refunds/:id/retry` can reset it only after a human checked Paymob). The requeue sweep must ignore `executing` rows.

**Test.** Refund-execution spec: `refundTransaction` resolves, the recording step throws, a second `executeRefund` call does **not** call `refundTransaction` again and the row is `executing`.

---

## F5 — MEDIUM — Permanent webhook failures loop forever instead of parking

**Status:** Open.

**Evidence.** `payment-webhook.processor.ts:171-176` throws on an amount mismatch; `:124-131` throws when the attempt is not found. Both are correct for the transient case (webhook beat the intent row) but there is no bound. `duffel-webhook.processor.ts:124-137` has the same shape for `order.created` events whose order carries no `supplier_idempotency_key` (orders created outside this platform): never resolvable, re-enqueued every minute, each run calling `getOrder`.

**Fix.** Give events an `attempt_count` (or reuse `received_at` age): after N sweeps or 24 h, set `processed_at` with a `failure_reason`, log at error level. Admin can list parked events. This also contains F2 until F2 is fixed.

**Test.** Sweep spec: an event older than the cap is parked, not re-enqueued.

---

## F6 — MEDIUM — Cancellation checks `confirmed` without a lock before calling Duffel

**Status:** Open.

**Evidence.** `bookings/services/bookings.service.ts:707` and `admin/admin.service.ts` (cancel path) read the booking without `pessimistic_write`, call `DuffelService.cancelOrder` (quote + confirm) outside any transaction, then `transitionTo(cancelled)` inside one. Two concurrent cancels (user and admin, or a double click past the frontend guard) both pass the status check, both call Duffel; the second `transitionTo` is a no-op on `cancelled`, so the second caller writes **no** refund row but Duffel may have been asked twice.

**Fix.** Take the row lock and the status check in a transaction, write a `cancellation_in_progress_at` marker, commit, then call Duffel. Or simply rely on Duffel's 4xx for the second cancel and swallow it; but then make the second caller return the existing result rather than a 500.

**Test.** Service spec: two concurrent `cancelBooking` calls → one Duffel call, one refund row.

---

## F7 — LOW — `Idempotency-Key` is global, not per user

**Status:** Fixed on `fix/trust-proxy-and-idempotency-scope` (commit `f57e903`): key is `idempotency_booking:<user.sub>:<key>`; first `BookingsController` spec added. Not yet merged to `main`.

**Evidence.** `bookings/bookings.controller.ts:48` keys Redis on the raw header. Replay goes through `getBookingDetail`, which enforces ownership (`bookings.service.ts:598`), so there is no data leak; a cross-user key collision returns 403 instead of creating the booking.

**Fix.** Key on `idempotency_booking:${user.sub}:${key}`.

---

## F8 — LOW — Stripe residue that can mislabel money

**Status:** Fixed on `fix/refund-transaction-id` (commit `abd2c63`): `payments.provider` default flipped to `paymob` in migration `1759…`, `stripe` dependency dropped, `client_secret` removed from `PUT /bookings/:id/passengers`. Not yet merged to `main`.

`PaymentProvider.Stripe` is still the column default on `payments.provider` (`payments/entities/payment.entity.ts:46`), `stripe` is an unused runtime dependency, and `PUT /bookings/:id/passengers` returns a fake `client_secret`. A `Payment` row created by any future path that forgets to set `provider` is recorded as Stripe. **Fix:** migration to set the default to `paymob`, drop the dependency, drop the fake field from the response and the contract.

---

## Observations not turned into findings

- `transaction.failed` leaves the booking in `awaiting_payment` with no customer-facing signal beyond the attempt row; the web payment page polls booking status, so a decline looks like "still processing" until the user retries. Product gap, covered by the B1b plan.
- `toPaymobGatewayAmount` converts non-EGP with fixed sandbox rates and is bypassed under Jest. The B2 pricing-engine plan replaces it; until then no non-EGP booking should be accepted in production.
- Migrations `1752…`, `1753…`, `1758…` default ids to `uuid_generate_v4()` while every other table uses `gen_random_uuid()`. Nothing in the repo creates the `uuid-ossp` extension; it works because TypeORM runs `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` on connect when an entity has a uuid primary key (`installExtensions` defaults to true, `PostgresDriver.js:323-362`). On a managed Postgres where the app role lacks that privilege, TypeORM only logs a warning and those three migrations fail. Switching the three defaults to `gen_random_uuid()` removes the dependency.
- Crons and workers run inside the single API process; fine with one replica, a double-run trap if ever scaled.

## Suggested order

F1 and F7 are one-line changes. F3 and F8 are a migration plus a few lines. F2 and F4 change behaviour and need the new tests before the code. F5 and F6 can follow.

## Branch stack and merge order

Four fix branches carry F1–F4, F7 and F8, in this merge order: `fix/trust-proxy-and-idempotency-scope` → `fix/refund-transaction-id` → `fix/payment-after-terminal-state` → `fix/refund-executing-marker`. The last three are stacked — each is built on the previous one and contains its commits — so each must merge to `main` before the PR for the next is opened, or the next PR shows the earlier branch's diff as well. `fix/trust-proxy-and-idempotency-scope` branches from `main` directly (it is not contained in the other three) and goes first because it is the smallest. None is merged yet; the living docs mark every statement that depends on them with `(pending: fix/<branch>)`.

## Backlog for the next review (candidates, not yet confirmed line by line)

Surfaced while re-verifying the docs; each needs the same second reading the findings above got before it becomes one.

Auth and request handling
- The refresh cookie is `SameSite=None` in production and `POST /auth/refresh` / `POST /auth/logout` check neither Origin nor a CSRF token: a cross-site form post can force a rotation or a logout (nuisance, not theft).
- `AuthIdentity` upsert uses `orIgnore()`: a Google `sub` already attached to another account is silently not linked and sign-in proceeds on the email-matched account.
- Magic-link rate-limit check and increment are two Redis round trips, not atomic.
- Logout revokes only the presented refresh token, not its family; expired and revoked `refresh_tokens` are never purged, nor are `supplier_webhook_events`.
- The raw Paymob callback is stored verbatim in `payment_webhook_events.payload`; confirm what card metadata Paymob includes.

API surface
- `/health` failure is rendered by the global filter as `503 SUPPLIER_UNAVAILABLE` with the Terminus details dropped.
- Customer `/bookings/:id` routes have no `ParseUUIDPipe`; a non-UUID id likely becomes a Postgres cast error and a 500.
- `GET /bookings?limit=abc` passes `NaN` to `take()`; no upper bound on `limit`.
- `ValidationPipe` strips unknown fields silently instead of rejecting them.
- `OFFER_EXPIRED` is 410 on create and offer fetch but 409 on passengers and payment-intent; `PAYMENT_REQUIRED` is defined and never thrown.

Data and jobs
- `payment_attempts.provider_reference_id` has both a UNIQUE constraint and a redundant non-unique index.
- The schedule-change diff compares `toISOString().slice(0, 19)` of a Date built from a timezone-less local string; correct only while the container runs in UTC.
- Unmatched `order.created` events (orders not created by this platform) are re-enqueued every minute forever, each run calling `getOrder` (part of F5).
- `docs/erd.png` is stale relative to the text.

Product remnants
- `sitemap.ts`, `llms.txt` and the root layout metadata advertise `/hotels`, which does not exist.
- `toPaymobGatewayAmount` converts non-EGP with fixed sandbox rates and is bypassed under Jest; `GET /api/v1/` still returns the scaffold `Hello World!`.
