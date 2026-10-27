# TravelHub — Non-Functional Requirements (Phase 1)

**Status:** Verified against code 2026-10-27 (main @ b176f47)
**Pending:** reflects fix branches fix/trust-proxy-and-idempotency-scope, fix/refund-transaction-id, fix/payment-after-terminal-state, fix/refund-executing-marker not yet merged to main.
**Inputs:** [archive/prd.md](archive/prd.md) §8 (NFR summary this doc expands), [erd.md](erd.md), [duffel_api_integration_guide.md](duffel_api_integration_guide.md), [auth_flow.md](auth_flow.md), [deployment.md](deployment.md).

Each section states the requirement, the mechanism **as implemented**, and the number from code. Portfolio-project posture: real requirements sized honestly — no pretend five-nines. Where the code does *not* do something the July draft promised, that is stated rather than papered over.

Deployment shape this doc assumes (deployment.md): backend + Postgres + Redis in `docker-compose.prod.yml` on one Azure VM (B1s) behind Caddy (`Caddyfile`: `reverse_proxy backend:3001`, Let's Encrypt), web app on Vercel. Payment gateway is **Paymob**; there is no Stripe integration anywhere in the code.

---

## 1. Security & sessions

- Token strategy as specified in [auth_flow.md](auth_flow.md) §4: access JWT `{sub, role}` with `ACCESS_TOKEN_TTL_SECONDS` = 900 (15 min) by default; opaque refresh token, SHA-256-hashed at rest, `REFRESH_TOKEN_TTL_DAYS` = 30 by default, rotated on every `POST /auth/refresh` with family-wide revocation on reuse; `httpOnly` cookie scoped to `/api/v1/auth`, `secure` + `SameSite=None` in production. No passwords, no password storage, no reset flow — that entire attack surface doesn't exist.
- **Config validation:** `ConfigModule` runs a Joi schema at boot (`app.module.ts`). Required: `DATABASE_URL` (uri), `REDIS_URL` (uri), `JWT_SECRET`. Defaults: `NODE_ENV` ∈ dev/test/production (default development), `PORT` 3001, `WEB_APP_URL` `http://localhost:3000`, the two token TTLs. Optional integer `TRUST_PROXY_HOPS` (≥ 0): unset = 1 in production, 0 elsewhere (pending: fix/trust-proxy-and-idempotency-scope). Optional, empty = unconfigured: `RESEND_API_KEY`, `MAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `DUFFEL_API_KEY`, `DUFFEL_WEBHOOK_SECRET`, `PAYMOB_API_BASE/API_KEY/INTEGRATION_ID/IFRAME_ID/HMAC_SECRET`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`. An unconfigured integration makes its endpoints return `503 SUPPLIER_UNAVAILABLE` via `assertConfigured()`; the app still boots.
- All secrets come from the environment (`.env` on the VM, Vercel project settings for the web); never in the repo (`.env.example` ships empty values).
- **HTTP hardening (`main.ts`):** `helmet()` defaults; CORS `origin: WEB_APP_URL` (one exact origin) with `credentials: true`; `cookie-parser`; JSON body limit **1 MB** (`express.json({ limit: '1mb' })`); `rawBody: true` so webhook signatures are checked over the exact bytes; global `ValidationPipe({ whitelist: true, transform: true })` strips unknown properties on every DTO; `X-Request-Id` echoed on every response (§7); global prefix `/api/v1`, `/health` unprefixed.
- **Webhook endpoints verify signatures before touching the DB.** `POST /api/v1/webhooks/paymob` (`payments/webhooks.controller.ts`): HMAC-SHA512 over Paymob's fixed field list, compared with `timingSafeEqual` against the `?hmac=` query param; non-`TRANSACTION` callback types are acked and ignored. `POST /api/v1/webhooks/duffel` (`bookings/duffel-webhooks.controller.ts`): `X-Duffel-Signature` over the raw body. Invalid/missing signature → `400`, no event row, no side effects. Missing `PAYMOB_HMAC_SECRET` / `DUFFEL_WEBHOOK_SECRET` → `503`, never a silent accept.
- Input validation at the DTO layer (class-validator) on every endpoint; the per-passenger Duffel field rules are validated server-side, never trusted from the client.
- **Authorization:** no global auth guard — endpoints opt in with `@UseGuards(JwtAuthGuard)`; admin controllers add `RolesGuard` + `@Roles(technical_admin)` (auth_flow §5). Booking reads/mutations check `booking.userId === user.sub` in `BookingsService` (`403`/`404` otherwise).
- **Client address behind Caddy:** `main.ts` sets Express `trust proxy` via `configureTrustProxy` (`common/http/trust-proxy.ts`). The hop count comes from `TRUST_PROXY_HOPS`, defaulting to **1** in production (Caddy is the one hop and sets `X-Forwarded-For`) and **0** elsewhere, so a directly reachable dev process does not believe a forged header. `req.ip` — the throttler tracker, the magic-link IP cap, the search inbound limit and `refresh_tokens.ip` — is therefore the real client address (pending: fix/trust-proxy-and-idempotency-scope).

## 2. PCI scope

Target: **SAQ-A** (hosted/iframe capture). Card data is entered into **Paymob's hosted iframe** in the browser and goes directly to Paymob; the backend never receives it.

- `payments/services/paymob.service.ts` `createPaymentKey()` registers an order (`/ecommerce/orders`, `merchant_order_id` = `<bookingId>:<suffix>`, `amount_cents` in minor units) and requests a payment key (`/acceptance/payment_keys`, `expiration: 3600`, billing data = name/email/phone only, address fields `NA`). It returns `iframeUrl = ${PAYMOB_API_BASE}/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=…` (null when `PAYMOB_IFRAME_ID` is unset).
- `app/web/src/app/checkout/payment/page.tsx` renders that URL in an `<iframe>`; `checkout/payment-return/page.tsx` is Paymob's "transaction response callback" target and only breaks out of the iframe back to the app — it reads no card data. The page states to the user that card data is never stored on our servers.
- Consequently no PAN, CVV or expiry transits or rests in TravelHub systems; `PaymentAttempt.method` is a nullable category string, never card details. The backend sees Paymob order/transaction ids and the webhook payload.
- `> Note:` the raw Paymob callback body is persisted verbatim in `payment_webhook_events.payload` (§7). Paymob transaction callbacks carry card *metadata* (brand, masked PAN) — not verified against a live payload here; if a future gateway or callback shape included more, this stores it.
- Adding another gateway must preserve this posture (hosted/iframe capture) or explicitly re-open the assessment.

## 3. Rate limiting — inbound and outbound

**Outbound to Duffel** (the hard limit: 120 req/60 s on search): a Redis **token bucket** `duffel_rate_limit:search`, capacity **100** (margin below 120), refill **120 tokens / 60 s**, shared by `FlightsService` (search) and `BookingsService` (offer revalidation at booking creation — `bookings.service.ts:112-115`). Empty bucket → `429 RATE_LIMITED` ("Flight search service is currently busy") rather than blowing the supplier budget. The search cache is the first line of defence: Redis key per normalised query, TTL = `min(120 s, min(offer.expires_at − now))` (`calculateCacheTtl`).

**Inbound:**

| Scope | Mechanism | Number |
|---|---|---|
| Every route | `ThrottlerModule` + `ThrottlerGuard` as `APP_GUARD` (`app.module.ts`) | **100 req / 60 s per IP** |
| `GET /flights/search` | `@Throttle` override **and** a second Redis sliding window in `FlightsService.checkInboundRateLimit` | **30 / 60 s per IP** (both) |
| `GET /flights/airports/search` | `@Throttle` override | **120 / 60 s per IP** |
| `POST /auth/magic-link/request` | Redis counters, silent `202` when exceeded (auth_flow §3) | **3 / email**, **10 / IP** per 15-min window |
| `POST /bookings` | `Idempotency-Key` header → Redis `idempotency_booking:<user.sub>:<key>` (scoped per user, pending: fix/trust-proxy-and-idempotency-scope): `locked` for **120 s** while in flight (`409` on a concurrent duplicate), then the booking id kept **24 h** so a replay returns the same booking | — |
| `/admin/*`, `/admin/ledger`, `/admin/support/tickets` | `@SkipThrottle()` — exempt but every mutation writes `AuditLog` | — |

`429` from the guard is normalised to the `RATE_LIMITED` envelope by `GlobalExceptionFilter`.

With `trust proxy` set to the Caddy hop (§1), the "per IP" limits above are per client and the magic-link IP cap (10 / 15 min) is per visitor; the production default needs no `TRUST_PROXY_HOPS` to be set (pending: fix/trust-proxy-and-idempotency-scope).

## 4. Consistency & integrity (mechanisms, cross-referenced)

The load-bearing set, defined authoritatively elsewhere, restated here as requirements and confirmed in code:

- Booking status transitions only via [booking_state_machine.md](booking_state_machine.md) (`BookingStateMachineService`), under `pessimistic_write` row locks, each writing `BookingStatusHistory` in-transaction.
- Money invariants in the DB: `ck_bookings_total_match CHECK (total_amount = base_amount + markup_amount)`, `ck_passengers_infant_adult`, unique constraints on payment attempts (`ux_payment_attempts_provider_ref`), webhook events (`ux_payment_webhook_events_provider_event` on provider + event id) and supplier webhook events — the database is the last line of defence, not the service code.
- Webhook processing is idempotent (unique event ids; Paymob dedupes on `<transaction.id>:<state>`) and eventually complete: `PaymentWebhookSweepService` and `DuffelWebhookSweepService` run `EVERY_MINUTE` and re-enqueue rows with `processed_at IS NULL` received more than 60 s ago.
- Duffel order creation: `AbortSignal.timeout(130_000)` (other Duffel calls 15–30 s), a timeout/network error is `DuffelAmbiguousError` — never retried blindly; `DuffelReconciliationService` (`*/2 * * * *`) scans bookings stuck in `paid` for > 15 min and matches Duffel orders by the metadata-echoed `supplier_idempotency_key` (state machine §4). `ExpirySweepService` (`EVERY_MINUTE`) fails `pending`/`awaiting_payment` bookings whose offer has expired, except while a payment attempt is in `requires_action` younger than 30 min (`PAYMENT_IN_FLIGHT_GRACE_MS`) — the customer may still be on the Paymob page (pending: fix/payment-after-terminal-state). `RefundRequeueSweepService` (`*/5 * * * *`) re-enqueues `pending` refunds that have no live job; refunds in `executing` (gateway called, outcome never recorded) are never re-enqueued automatically — refund execution claims the row before calling Paymob and parks it on an unknown outcome (pending: fix/refund-executing-marker).
- Account resolution races are absorbed by `ux_users_email` and the two `auth_identities` unique constraints (auth_flow §1).

## 5. Availability & graceful degradation

- **Duffel slow/down:** every Duffel call has a hard timeout and maps failures to `503 SUPPLIER_UNAVAILABLE` with a user-facing message; the web client caps every request at **45 s** (`REQUEST_TIMEOUT_MS`, `api-client.ts`) and shows a timeout/network error rather than a hung spinner. Per-hour request/error counters live in Redis (`duffel:metrics:*`, 1 h TTL) and surface in `GET /admin/health/duffel`. There is **no circuit breaker** — a dead Duffel still costs each request its timeout.
- **Queue jobs (BullMQ on the same Redis):**
  - `refund_execution_queue`: **5 attempts, exponential backoff from 30 s** (30 s → 1 m → 2 m → 4 m → 8 m), `jobId = refund:<id>` so a refund never has two live jobs, `removeOnFail: true` so `POST /admin/refunds/:id/retry` can re-enqueue.
  - `order_fulfillment_queue`: enqueued with `attempts: 1`, `removeOnFail: 100` — a failed fulfilment is resolved by the reconciliation cron, not by job retries.
  - `payment_webhook_queue` / `duffel_webhook_queue`: BullMQ defaults (single attempt); recovery is the `processed_at IS NULL` sweeps (§4).
  - "DLQ depth" = BullMQ failed-set size for `payment_webhook_queue` and `order_fulfillment_queue`, exposed in `GET /admin/health/duffel` (`queues.*.failed`). There is no separate dead-letter queue and no alerting.
  - A failed email/PDF never affects booking state: `MailService.send()` swallows transport errors and logs them.
- Single deployed environment — no HA target; the requirement is *honest failure*: any component outage degrades to a clear error, and no money/booking state may be corrupted by a mid-flight crash (guaranteed by §4 mechanisms). `GET /health` (Terminus) checks Postgres (`TypeOrmHealthIndicator.pingCheck`) and Redis (`PING`) and is what the compose healthcheck/uptime probe should hit.
- Redis is restarted/lost-safe: it holds cache, rate-limit counters, idempotency keys and BullMQ state only; every queue has a DB-backed sweep to rebuild from.

## 6. Performance targets (p95, measured from the API)

| Operation | Target | Note |
|---|---|---|
| `/flights/search` (cache miss) | ≤ 6 s | Dominated by Duffel (30 s hard timeout) |
| `/flights/search` (cache hit) | ≤ 300 ms | Redis, TTL ≤ 120 s |
| Booking creation (T1) + offer revalidate | ≤ 3 s | |
| Payment key creation | ≤ 2 s | Two Paymob calls (auth token cached ~1 h) |
| `paid` → `confirmed` (order + ticket) | ≤ 60 s typical; state machine tolerates minutes | Reconciliation after 15 min |
| Webhook ack | ≤ 500 ms | Verify + insert + enqueue only |
| Webhook processing lag (received → processed) | ≤ 60 s | Sweep every minute; admin dashboard shows oldest unprocessed age |

`> Note:` these remain targets. No load test or APM data exists; backend Sentry runs without tracing (§7), so nothing measures p95 today.

## 7. Observability & audit

- **Request id:** `RequestIdMiddleware` (`common/middleware`) reuses an inbound `X-Request-Id` or generates a UUID, echoes it on the response, and stores it in `AsyncLocalStorage` (`common/logging/request-context.ts`) for the life of the request. The Paymob webhook controller copies it into the job payload so the worker's log lines correlate to the inbound call; cron jobs have no request id by design.
- **Structured logs:** `StructuredLoggerService` (`common/logging/structured-logger.service.ts`) is the app logger. In production (`NODE_ENV=production`) it writes JSON lines `{ level, pid, timestamp, context, message, request_id, stack? }`; elsewhere Nest's pretty output. **PII scrub:** `redact()` replaces email- and phone-shaped substrings in every message (pattern-based, not a DLP). Log Duffel/Paymob *ids*, not payloads.
- **Sentry (backend):** `instrument.ts` is the first import in `main.ts`. Errors only — no `tracesSampleRate`; `sendDefaultPii: false`; `beforeSend` drops request body and cookies, strips `authorization`/`cookie` headers, and runs `redact()` over the message and exception values. What gets reported: every **error-level log line** — `GlobalExceptionFilter` logs `HttpException`s with status ≥ 500 and all unhandled exceptions at error level, and BullMQ processors / crons / webhook handlers log their failures the same way — so one hook covers HTTP 5xx and background work. **4xx (401/403/404/422/429) are never reported.** Messages are fingerprinted with ids/numbers collapsed so one failure mode is one issue; `requestId` and logger context become tags. Empty `SENTRY_DSN` = no-op (dev, CI, tests).
- **Sentry (web):** `@sentry/nextjs` (`instrumentation.ts`, `instrumentation-client.ts`), enabled only in production, `tracesSampleRate: 0.1`, Session Replay off (it would record passenger PII and card iframes).
- **Metrics:** `GET /admin/health/duffel` returns Duffel `requests_last_hour` / `errors_last_hour` / `recent_error_rate`, `webhooks.unprocessed_count` + `oldest_unprocessed_age_seconds`, failed-job counts for the two queues, and `bookings_stuck_in_paid` (> 15 min). `GET /admin/metrics` returns the overview dashboard numbers. No Prometheus/OpenTelemetry export and no alerting — "alert if a booking is `paid` > 30 min" is a human reading the dashboard.
- `AuditLog` on every admin mutation (`AuditLogService.logAction` inside `AdminService` transactions) and `BookingStatusHistory` on every transition are **non-optional** (service-layer enforced).
- Raw webhook payloads retained in `payment_webhook_events.payload` and `supplier_webhook_events` — replayable history for disputes and debugging.

## 8. Data protection & retention

- **PII inventory:** passenger names/DOB/contact + **identity document numbers** (the sensitive tier), user emails/phones. Access: booking owner (`booking.userId === user.sub`) and `technical_admin` only — enforced at the service layer.
- `> Note:` the July draft promised document numbers masked in list views (`A•••••67`). No masking exists in the backend or the web app today; document numbers are returned as stored to the owner and admins.
- **At-rest encryption:** Postgres runs in Docker on the VM's managed disk; no column-level encryption for `document_number` (a noted Phase 2 hardening item, not a Phase 1 gate).
- **Retention / purge crons** (`@nestjs/schedule`, server local time):

| Data | Policy | Code |
|---|---|---|
| `magic_link_tokens` | deleted when `expires_at < now − 24 h` | `MagicLinkTokenPurgeService`, `0 3 * * *` |
| `payment_webhook_events` | deleted when `processed_at IS NOT NULL` and `received_at < now − 90 d`; unprocessed rows are never pruned, and `transaction.succeeded` rows are kept for good — the audit record of money in and the fallback source of the Paymob transaction id (pending: fix/refund-transaction-id) | `WebhookRetentionService`, `0 4 * * *` |
| `supplier_webhook_events` (Duffel) | **no purge** — kept indefinitely | — |
| `refresh_tokens` (expired/revoked) | **no purge** — kept indefinitely | — |
| bookings / payments / refunds / ledger / audit logs | kept indefinitely (commercial records) | — |

- **Account deletion:** not implemented. Admins can deactivate (`is_active = false`, which also revokes refresh tokens); there is no anonymise/tombstone routine. The intended policy stays: deactivate + anonymise `User` (email → tombstone), keep booking records (legal/financial reality).
- **Backups:** `scripts/backup-db.sh` does a `pg_dump` out of the container to `~/backups/postgres/travelhub-<timestamp>.dump`, verifies the archive, and prunes dumps older than `RETENTION_DAYS` (**14**). It runs from the VM's crontab at `15 3 * * *` (deployment.md §8) and protects against bad migrations/accidental deletes, **not** against losing the VM or its disk (the dumps live on the same machine). Redis is rebuildable state (cache/locks/queue) — no backup; queue jobs are safe to lose-and-reconcile (§4 sweeps).

## 9. Compliance posture (stated, not aspirational)

Phase 1 is a single-operator portfolio deployment: whatever `PAYMOB_*` and `DUFFEL_API_KEY` carry (test or live) decides whether money moves, and the card-data posture in §2 holds either way. Real PII only from real sign-ups. GDPR-grade tooling (export, erasure automation) is out of scope until there are customers to owe it to — the schema and the §8 policies are shaped so adding it is procedural (one anonymise routine, two purge crons) rather than structural.
