# TravelHub — API Contract (Phase 1)

**Status:** Verified against code 2026-10-27 (main @ b176f47)
**Inputs:** [archive/prd.md](archive/prd.md) §5, [erd.md](erd.md), [booking_state_machine.md](booking_state_machine.md) (transitions T1–T9 mapped to endpoints below), [auth_flow.md](auth_flow.md), [nfr.md](nfr.md).

Conventions first, then one endpoint group per functional area. This is the human-readable contract, written from the NestJS backend under `app/Backend/src` (controllers, DTOs, guards, services). No OpenAPI spec is generated today — the controllers carry no `@nestjs/swagger` decorators — so this document is the only contract and must be re-verified whenever a controller or DTO changes.

---

## 0. Conventions

- **Base path:** `/api/v1` (`app.setGlobalPrefix('api/v1')` in `main.ts`). The only unprefixed route is `GET /health`. JSON only; request bodies are capped at 1 MB.
- **Auth:** `Authorization: Bearer <access token>` (hand-rolled `JwtAuthGuard`, no Passport; see [auth_flow.md](auth_flow.md)). Endpoints marked 🔓 are public, 👤 need a valid JWT, 🛡 need the JWT **and** role `technical_admin` (`UserRole` enum in `users/user.entity.ts`: `user` | `technical_admin`; checked by `RolesGuard`). A missing/invalid token → `401 UNAUTHENTICATED`; wrong role → `403 FORBIDDEN`.
- **Money:** integer minor units + ISO 4217 `currency`, everywhere, matching the ERD. `{"amount": 154200, "currency": "USD"}` = $1,542.00.
- **Times:** flight times are local wall-clock with IANA timezone (`{"local": "2026-08-01T09:15:00", "timezone": "Africa/Cairo"}`); system timestamps are UTC ISO 8601.
- **Validation:** global `ValidationPipe({ whitelist: true, transform: true })` — unknown body/query fields are **silently stripped** (not rejected); class-validator failures → `400 VALIDATION_ERROR` with `details.constraints: string[]`.
- **Status codes on POST:** NestJS defaults a `POST` to `201 Created` unless the handler sets `@HttpCode`. Only the auth routes override this (noted per endpoint); every other `POST` in this API — including both webhook receivers — answers `201`.
- **Errors:** one envelope, always (`GlobalExceptionFilter`):

```json
{ "error": { "code": "OFFER_EXPIRED", "message": "human-readable", "details": {} } }
```

`ErrorCode` enum (`common/dto/error-response.dto.ts`): `VALIDATION_ERROR` (400, also 422 for business-rule rejections), `UNAUTHENTICATED` (401), `TOKEN_INVALID` (401, magic-link only), `FORBIDDEN` (403), `NOT_FOUND` (404), `OFFER_EXPIRED` (410 at offer fetch / T1, **409** at T2 and payment-intent), `ILLEGAL_TRANSITION` (409), `PAYMENT_REQUIRED` (402 — defined, **never thrown** today), `RATE_LIMITED` (429), `SUPPLIER_UNAVAILABLE` (503), `INTERNAL_ERROR` (500, any unhandled exception). Framework-thrown exceptions without a `code` (e.g. `ParseUUIDPipe`, `ThrottlerGuard`, bare `BadRequestException`) are mapped by HTTP status: 400→`VALIDATION_ERROR`, 401→`UNAUTHENTICATED`, 403→`FORBIDDEN`, 404→`NOT_FOUND`, 429→`RATE_LIMITED`, 503→`SUPPLIER_UNAVAILABLE`, anything else→`INTERNAL_ERROR`.
- **Pagination — two styles coexist:**
  - Customer bookings (`GET /bookings`): cursor — `?limit=` (default **10**, no upper bound enforced) + `?cursor=`; response `{"data": [...], "next_cursor": "…" | null}`. Flight search also returns this envelope but always with `next_cursor: null`.
  - Every admin list (`/admin/*`, `/admin/ledger`, `/admin/support/tickets`): offset — `?limit=` (default 20, max 100) + `?offset=` (min 0); response `{"<plural>": [...], "total", "limit", "offset"}`.
- **Rate limiting:** global `ThrottlerGuard` 100 req/min/IP (`app.module.ts`). `GET /flights/search` tightens to 30/min/IP (plus a Redis sliding window at the same limit in `FlightsService`, and an outbound Duffel token bucket shared with `POST /bookings`); `GET /flights/airports/search` 120/min/IP. `AdminController`, `LedgerController` and `AdminSupportController` are `@SkipThrottle()` (nfr.md §3 "admin exempt but audited"). The customer `SupportController` is **not** exempt. Over limit → `429 RATE_LIMITED`.
- **Idempotency:** `POST /bookings` accepts an optional `Idempotency-Key` header (see §3).
- **Request id:** `RequestIdMiddleware` runs on every route; the id is carried into queue jobs for log correlation (nfr.md §7).

---

## 1. Auth 🔓

| Method & path | Status | Behaviour |
|---|---|---|
| `GET /auth/google` | 302 | Generates HMAC-signed `state` + PKCE verifier, stores both in 10-minute httpOnly cookies (`oauth_google_state`, `oauth_google_verifier`, path `/api/v1/auth`), redirects to Google |
| `GET /auth/google/callback?code=&state=` | 302 | Browser flow — **never returns JSON**. Verifies state/PKCE, exchanges the code, requires `email_verified`, find-or-creates user + `AuthIdentity`, sets the refresh cookie, then redirects to `${WEB_APP_URL}/auth/callback`. Any failure redirects to `${WEB_APP_URL}/auth/callback?error=auth_failed`, or `?error=account_disabled` when the account is deactivated |
| `POST /auth/magic-link/request` | 202 | Body `{"email": "…"}` (`@IsEmail`). Always `202 {"message": "If that email is registered, a link has been sent."}` — no account enumeration. Silently skips sending when over the Redis limits (3 per email or 10 per IP per 15 min); the link itself expires after 15 min |
| `POST /auth/magic-link/verify` | 200 | Body `{"token": "…"}` → session response. Unknown/expired/used token → uniform `401 TOKEN_INVALID`; deactivated account → `403 FORBIDDEN` |
| `POST /auth/refresh` | 200 | Reads the `refresh_token` cookie, rotates it (same family), returns a new session response. Missing cookie / unknown / expired token → `401 UNAUTHENTICATED`; **reuse of an already-rotated token revokes the whole family** and clears the cookie (`401`); deactivated account → `401` |
| `POST /auth/logout` | 200 | Revokes the presented refresh token (if any) and clears the cookie → `{"message": "Logged out"}`. Never errors on a missing cookie |
| `GET /me` 👤 | 200 | `{ id, email, full_name, phone, role }` read fresh from the DB; `401 UNAUTHENTICATED` if the JWT's user no longer exists |

Session response shape (`verify` + `refresh`; the Google callback sets the cookie and redirects instead):

```json
{ "access_token": "<JWT sub+role>", "expires_in": 900, "user": { "id", "email", "full_name", "phone", "role" } }
```

The refresh token is set as an httpOnly cookie only (`refresh_token`, path `/api/v1/auth`, `SameSite=None; Secure` in production / `Lax` in dev, 30-day max-age) — never in the body. Access TTL defaults to 900 s (`ACCESS_TOKEN_TTL_SECONDS`).

> Note: `GET /api/v1/` (root `AppController`) exists and returns the plain string `Hello World!`. It is a scaffold leftover, not part of the contract.

## 2. Flight search 🔓

**`GET /flights/airports/search?query=cai`** — airport/city autocomplete via Duffel places. Returns `{"data": [{ code, city, country, type: "airport" | "city", name }]}` (only suggestions that carry an IATA code). Empty/blank `query` → `{"data": []}`; a Duffel error is swallowed and also yields `[]`. `503 SUPPLIER_UNAVAILABLE` only when `DUFFEL_API_KEY` is unconfigured.

**`GET /flights/search?origin=CAI&destination=RUH&departure_date=2026-08-01&return_date=&adults=1&children=0&infants=0&cabin_class=economy`**

Query validation (`FlightSearchQueryDto`): `origin`/`destination` must match `^[A-Z]{3}$` (uppercase only); dates `YYYY-MM-DD`; `adults` integer ≥ 1 (required); `children`/`infants` integer ≥ 0 (default 0); `cabin_class` optional, one of `economy | premium_economy | business | first`. Results are cached in Redis for `min(120 s, soonest offer expiry)`.

Returns normalized offers (never raw Duffel shapes — adapter rule from the integration guide §5):

```json
{
  "data": [{
    "offer_id": "off_x",
    "expires_at": "2026-07-04T18:21:00Z",
    "total": { "amount": 154200, "currency": "USD" },
    "airline": { "name": "EgyptAir", "iata": "MS", "logo_url": "…" },
    "cabin_class": "economy",
    "passenger_identity_documents_required": false,
    "slices": [{
      "origin": "CAI", "destination": "RUH", "duration": "PT3H25M",
      "segments": [{
        "marketing_carrier": "MS", "operating_carrier": "MS", "flight_number": "651",
        "departing_at": { "local": "2026-08-01T09:15:00", "timezone": "Africa/Cairo" },
        "arriving_at":  { "local": "2026-08-01T12:40:00", "timezone": "Asia/Riyadh" },
        "origin_terminal": "3", "destination_terminal": null
      }]
    }],
    "conditions": {
      "refund_before_departure": { "allowed": true, "penalty": { "amount": 30000, "currency": "USD" } },
      "change_before_departure": { "allowed": false, "penalty": null }
    },
    "passengers": [{ "id": "pas_x", "type": "adult" }]
  }],
  "next_cursor": null
}
```

`passengers[]` carries Duffel's per-offer passenger ids; the same ids come back as `passenger_requirements` on `POST /bookings` and are what T2 binds submitted passengers to. `total` **includes markup** — the customer-facing price is the only price this API ever shows. Errors: `503 SUPPLIER_UNAVAILABLE` when Duffel is unconfigured or down; `429 RATE_LIMITED` from the per-IP limit or when the outbound token bucket is exhausted.

**`GET /flights/offers/:offer_id`** — revalidates against Duffel (fresh `expires_at`, price re-check) and returns `{"data": <offer>}` in the same normalized shape. Called at selection. `410 OFFER_EXPIRED` when Duffel answers 410/422; `404 NOT_FOUND` when the response carries no offer; `503 SUPPLIER_UNAVAILABLE` otherwise.

> Note: the Duffel call requests `return_available_services=true`, but `available_services` is not part of `NormalizedOffer` and is **not** surfaced to the client.

## 3. Bookings 👤

All routes require a JWT. Unless stated otherwise the caller must own the booking (`403 FORBIDDEN`); reads (`GET /bookings/:id`, `/documents`, `/ticket.pdf`, `/payment`) additionally allow `technical_admin`. Unknown id → `404 NOT_FOUND`.

| Method & path | State machine | Purpose |
|---|---|---|
| `POST /bookings` (201) | T1 | `{"offer_id": "…"}` → re-fetches the offer from Duffel, applies the active markup rule, creates `Booking` (`pending`) + `FlightOfferSnapshot`/`Slice`/`Segment`, writes the initial status-history row. Response is the raw booking row (camelCase entity fields) plus `passenger_requirements` (shape below). Errors: `410 OFFER_EXPIRED` (offer gone or `expires_at` in the past), `404`, `503 SUPPLIER_UNAVAILABLE`, `429 RATE_LIMITED` (outbound bucket) |
| `PUT /bookings/:id/passengers` (200) | T2 (or T3) | Full passenger list (shape below) → `awaiting_payment`. Guards: booking `pending` (`409 ILLEGAL_TRANSITION`), snapshot unexpired — an expired snapshot **first transitions the booking to `failed` (T3, reason `offer_expired`) and then** returns `409 OFFER_EXPIRED`. `400 VALIDATION_ERROR` for count mismatch vs the offer's passengers, type mismatch, missing `document` when the snapshot requires ID docs, or infant without a valid adult `responsible_adult_index`. Response: `{ booking_id, status: "awaiting_payment", client_secret, total_amount, currency }` |
| `GET /bookings?limit=&cursor=` | — | Own bookings, newest first (`created_at DESC, id DESC`), cursor = base64(`<created_at ISO>_<id>`). Each row is the summary shape below with `passengers: []` |
| `GET /bookings/:id` | — | Summary shape + `passengers[]` (see below) |
| `GET /bookings/:id/cancellation-quote` | pre-T7 | Owner only. Booking must be `confirmed` (`409 ILLEGAL_TRANSITION`). Returns `{ refundable, requires_admin, penalty: {amount, currency} \| null, customer_receives: {amount, currency} \| null }`, computed from the stored snapshot `conditions.refund_before_departure`: `requires_admin` is true when refund is not allowed or the penalty currency differs from the booking currency; `customer_receives` = `max(0, total_amount − penalty)` (estimate only) |
| `POST /bookings/:id/cancel` (201) | T7 | Body `{"reason"?: string}`. Owner only, booking must be `confirmed`. **Auto-approvable:** validates a refundable `Payment` exists (`succeeded`/`partially_refunded`, else `409 ILLEGAL_TRANSITION`), cancels the order at Duffel (`503 SUPPLIER_UNAVAILABLE` on failure — booking untouched), then in one transaction moves to `cancelled`, creates a pending `Refund` = supplier refund + full markup, writes a `supplier_refund` ledger row, and enqueues gateway execution. Response: `{ id, status: "cancelled", requires_admin: false, supplier_refund_amount, customer_receives: {amount, currency}, refund: {id, status} \| null, currency }`. **Not auto-approvable:** stamps `cancellation_requested_at`/`_reason` on the booking (status unchanged) and returns `{ id, status: "confirmed", requires_admin: true, message }` — still HTTP **201**, not 202 |
| `GET /bookings/:id/documents` | — | `{"data": [{ id, source: "supplier", type, supplier_document_id, file_url: null }]}` — metadata only; `file_url` is always `null` |
| `GET /bookings/:id/ticket.pdf` | — | Streams a generated itinerary/e-ticket PDF (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="ticket-<id>.pdf"`). Booking must be `confirmed` (`409 ILLEGAL_TRANSITION`) |

> Note: `client_secret` returned by `PUT /bookings/:id/passengers` is a placeholder (`pi_mock_<id8>_secret_mocksecret`) left over from the Stripe design; the real checkout token comes from `POST /bookings/:id/payment-intent` (§4). Clients must not use it.

**Idempotency on `POST /bookings`:** with an `Idempotency-Key` header the controller writes `idempotency_booking:<key>` = `locked` in Redis (TTL 120 s) before calling the service, then stores the new booking id under the same key for 24 h. A second request while locked → `409 ILLEGAL_TRANSITION` ("request in progress"); a request after completion returns `GET /bookings/:id` for the stored id (the summary shape — **not** the original T1 response, so `passenger_requirements` is absent on replay). On failure the key is deleted so the client can retry. Keys are global, not per user.

`passenger_requirements` (T1 response):

```json
{ "passenger_identity_documents_required": false,
  "passengers": [{ "supplier_passenger_id": "pas_x", "type": "adult" }] }
```

Passenger input shape (`PassengerInputDto`, Duffel-verified required set):

```json
{ "type": "adult", "title": "mr", "gender": "m",
  "given_name": "Ahmed", "family_name": "Hassan", "date_of_birth": "1990-04-12",
  "email": "a@example.com", "phone_number": "+201001234567",
  "responsible_adult_index": null,
  "document": { "type": "passport", "number": "A1234567", "expiry": "2030-01-01", "nationality": "EG" } }
```

Enums: `type` `adult | child | infant`; `title` `mr | ms | mrs | miss`; `gender` `m | f`. Dates `YYYY-MM-DD`; `nationality` exactly 2 chars. `phone_number` is normalised before validation — spaces, dashes and parentheses are stripped and a leading `00` becomes `+` — then must match E.164 `^\+[1-9]\d{6,14}$`. `document` is required only when the snapshot says so; `responsible_adult_index` (0-based index into the same array, must point at an `adult`) is required for infants. Passengers are matched to the offer's passenger ids by type, in order. Status is read-only via the API — **no endpoint sets `Booking.status` directly**; it only moves via the transitions above, the queue workers and the expiry sweep.

Booking summary shape (list rows and detail; snake_case):

```json
{ "id", "status", "supplier": "duffel", "booking_reference", "total_amount", "base_amount", "markup_amount", "currency",
  "schedule_change_detected_at", "created_at", "updated_at",
  "snapshot": { "id", "supplier_offer_id", "expires_at", "owner_airline_name", "owner_airline_iata", "cabin_class", "conditions",
                "slices": [{ "id", "origin", "destination", "duration", "segments": [{ "id", "marketing_carrier", "operating_carrier", "flight_number",
                              "departing_at": {"local","timezone"}, "arriving_at": {"local","timezone"}, "origin_terminal", "destination_terminal" }] }] } | null,
  "passengers": [{ "id", "supplier_passenger_id", "type", "title", "gender", "given_name", "family_name", "date_of_birth", "phone_number", "email",
                   "responsible_adult_passenger_id", "document": {"type","number","expiry","nationality"} | null }] }
```

`booking_reference` (PNR) and `supplier_order_id` are set at T5; the detail view exposes the PNR but not `supplier_order_id`.

## 4. Payments 👤

| Method & path | State machine | Purpose |
|---|---|---|
| `POST /bookings/:id/payment-intent` (201) | pre-T4 (or T3) | Owner only. Guards: status `awaiting_payment` (`409 ILLEGAL_TRANSITION`), snapshot unexpired — expiry **transitions the booking to `failed` (T3) and then** returns `409 OFFER_EXPIRED`. Creates the `Payment` row on first call (provider `paymob`, amount = `total_amount`), registers a Paymob order (merchant id `<booking_id>:<8 hex>`), requests a payment key, and inserts a `PaymentAttempt` (`requires_action`, `method: "card"`) keyed by the Paymob order id. Every call — including a retry after a failed attempt — creates a **new** attempt/key. Response: `{ provider: "paymob", payment_token, iframe_url \| null, amount, currency }`. `503 SUPPLIER_UNAVAILABLE` if Paymob is unconfigured or rejects |
| `GET /bookings/:id/payment` | — | Owner or admin. `null` body if no `Payment` exists yet, else `{ payment_id, status, provider, amount, currency, attempts: [{ id, provider_reference_id, status, failure_reason, method, attempted_at }], refunds: [{ id, provider_refund_id, amount, currency, supplier_refund_amount, status, reason, created_at }] }` (attempts and refunds newest first) |

Card data never touches this API: the client renders Paymob's hosted iframe (`iframe_url`) / uses `payment_token`; PCI SAQ-A per [nfr.md](nfr.md). Billing data sent to Paymob is taken from the lead adult passenger (fallback: the account's name/email).

## 5. Webhooks 🔓 (signature-verified, not session-auth)

| Method & path | Verification | Behaviour |
|---|---|---|
| `POST /webhooks/paymob?hmac=…` | Paymob HMAC over the transaction object, passed as the `hmac` **query parameter** | Only `body.type === "TRANSACTION"` with `body.obj` is processed — anything else is acked as `{ received: true, ignored: true }` without verification. HMAC failure → `400` (`VALIDATION_ERROR`, message "HMAC verification failed."), nothing stored. Event type is derived from the transaction flags (`transaction.pending` / `.succeeded` / `.failed`); dedupe key is `<transaction.id>:<event type>` (unique `provider`+`provider_event_id`), so state progressions of one transaction are kept while exact redeliveries collapse. Inserts `PaymentWebhookEvent`, enqueues `payment_webhook_queue`, acks fast. Drives **T4** (succeeded: amount must equal the gateway amount for `total_amount`, else the job fails and retries; writes `customer_payment` ledger row; enqueues Duffel order creation). A `failed` transaction only marks the attempt `failed` — the booking **stays `awaiting_payment`** for retry |
| `POST /webhooks/duffel` | `X-Duffel-Signature` header over the raw body | Signature failure or missing `id`/`type` → `400` (`VALIDATION_ERROR`), no insert. Inserts `SupplierWebhookEvent` (dedupe on event `id` `wev_…`; the envelope's `idempotency_key` is stored as `supplier_resource_id`), enqueues `duffel_webhook_queue`, acks fast. Handles `order.created` (→ **T5** via reconciliation, then confirmation email), `order.airline_initiated_change_detected` (sets `schedule_change_detected_at`), `ping.triggered` (ack only) |

Success body is `{ received: true }`; duplicate delivery (pre-check or unique-violation race) → `{ received: true, duplicate: true }`. Both handlers answer HTTP **201** (Nest default — no `@HttpCode(200)` is set).

> Note: T8/T9 (`cancelled`/`order_failed` → `refunded`) are **not** webhook-driven. Paymob refunds are executed synchronously by the `refund_execution_queue` worker (`RefundExecutionService.executeRefund`), which rolls up `Payment.status` and transitions the booking when the succeeded refunds cover the full payment. T6 comes from the order-fulfillment worker / reconciliation sweep, T3 from the expiry sweep (or inline at T2 / payment-intent as described above).

## 6. Documents 👤

`GET /bookings/:id/documents` and `GET /bookings/:id/ticket.pdf` — see §3. There is **no** `GET /documents/:id/download` and no signed blob URL: the e-ticket PDF is rendered on demand from the booking, snapshot, passengers and Duffel document ids.

## 7. Support 👤

Customer routes need any valid JWT and are subject to the global rate limit.

| Method & path | Purpose |
|---|---|
| `POST /support/tickets` (201) | `{ type, booking_reference?, description }` → ticket view. `type` ∈ `cancellation \| flight_delay \| name_change \| refund \| other`; `booking_reference` ≤ 32 chars, trimmed and a leading `#` stripped, stored as free text (deliberately not a FK); `description` 10–4000 chars, trimmed. New tickets are `open` |
| `GET /support/tickets` | Caller's own tickets, newest first, capped at **50**, no pagination → `{"data": [ticket view]}` |

Ticket view: `{ id, type, booking_reference, description, status: "open" | "in_progress" | "resolved", admin_note, created_at, updated_at }`. `admin_note` is the support team's reply, visible to the customer.

## 8. Admin 🛡

Every endpoint under `/admin` requires `technical_admin`, is exempt from rate limiting, and every mutation writes an `AuditLog` row — enforced in the service layer, not optional per endpoint. All `:id` params go through `ParseUUIDPipe` (`400 VALIDATION_ERROR` for a non-UUID). Lists are offset-paginated (`limit` 1–100 default 20, `offset` ≥ 0) and sorted `created_at DESC`.

| Method & path | Purpose |
|---|---|
| `GET /admin/users?email=&role=&is_active=&limit=&offset=` | `{ users: [{ id, email, full_name, phone, role, is_active, email_verified_at, created_at }], total, limit, offset }`. `email` must be a valid email (exact match), `role` ∈ `user \| technical_admin`, `is_active` `true`/`false` |
| `PATCH /admin/users/:id` | `{"is_active": bool}` → updated user row. Deactivation also revokes every refresh token of that user. `409 ILLEGAL_TRANSITION` when an admin deactivates their own account; `404` |
| `GET /admin/bookings?status=&user_id=&reference=&cancellation_requested=&limit=&offset=` | `{ bookings: [{ id, user_id, user_email, status, booking_reference, supplier_order_id, base_amount, markup_amount, total_amount, currency, payment_id, payment_status, cancellation_requested_at, cancellation_request_reason, created_at, updated_at }], total, limit, offset }`. `status` ∈ `BookingStatus`; `reference` = exact PNR for support lookups; `cancellation_requested=true` surfaces customer requests awaiting manual review |
| `POST /admin/bookings/:id/cancel` | T7 for non-auto-approvable cases. `{"reason"?: string ≤ 500}`. Booking must be `confirmed` (`409 ILLEGAL_TRANSITION`). Cancels at Duffel first (`503` leaves the booking confirmed), then in one transaction: → `cancelled`, pending `Refund` = supplier refund + full markup **when** a refundable payment exists (otherwise the cancellation still commits and `refund` is `null`), `supplier_refund` ledger row, audit row; refund execution is enqueued. Response: `{ id, status: "cancelled", supplier_refund_amount, customer_receives: {amount, currency}, refund: {id, status} \| null, currency }` |
| `POST /admin/payments/:id/refund` | Manual gateway refund `{"amount": int ≥ 1, "reason"?: ≤ 500}`. The pending `Refund` row + audit row commit first, then Paymob is called **inline**: on gateway failure the row is marked `failed` (retryable via `/admin/refunds/:id/retry`) and the error propagates (`503 SUPPLIER_UNAVAILABLE`). `404` unknown payment; `409 ILLEGAL_TRANSITION` if the payment is not `succeeded`/`partially_refunded`; `422 VALIDATION_ERROR` if `amount` exceeds the remaining refundable balance. Response: `{ id, payment_id, provider_refund_id, amount, currency, status, payment_status: "refunded" \| "partially_refunded", fully_refunded }` |
| `GET /admin/refunds?status=&limit=&offset=` | Refund pipeline monitor; `status` ∈ `pending \| succeeded \| failed` (`failed` lists retry candidates). `{ refunds: [{ id, payment_id, booking_id, booking_reference, provider_refund_id, amount, currency, supplier_refund_amount, status, reason, initiated_by_user_id, created_at, updated_at }], total, limit, offset }` |
| `POST /admin/refunds/:id/retry` | Re-enqueues a `failed` (flipped back to `pending`) or stuck `pending` refund → `{ id, status: "pending" }`. `409 ILLEGAL_TRANSITION` if already `succeeded`; `404` |
| `GET /admin/markup-rules` | `[{ id, type, value, is_active, created_by_user_id, created_at, updated_at }]` (bare array, newest first) |
| `POST /admin/markup-rules` | `{ type: "percentage" \| "fixed", value: number ≥ 0, is_active?: bool }` — `value` is a percent (5 = 5 %) or minor units; `422 VALIDATION_ERROR` if a percentage exceeds 100. Activating one deactivates the previous in the same transaction (partial unique index on `is_active = true` is the backstop) |
| `PATCH /admin/markup-rules/:id` | `{ value?, is_active? }` — same rules; `404` |
| `GET /admin/health/duffel` | `{ duffel: { configured, requests_last_hour, errors_last_hour, recent_error_rate }, webhooks: { unprocessed_count, oldest_unprocessed_age_seconds }, queues: { payment_webhook_queue: {failed}, order_fulfillment_queue: {failed} }, bookings_stuck_in_paid }` (stuck = `paid` and not updated for 15 min) |
| `GET /admin/metrics` | `{ bookings: { total, by_status: {<status>: n}, pending_cancellation_requests }, payments: [{ currency, charged_amount, refunded_amount, net_amount }], refunds: { pending_count, failed_count }, users: { total, active }, ledger: { summary: <GET /admin/ledger/summary> } }` — money never summed across currencies; charged = payments in `succeeded`/`partially_refunded`/`refunded`, refunded = `succeeded` refunds |
| `GET /admin/audit-logs?entity_type=&entity_id=&action=&actor_user_id=&limit=&offset=` | `{ audit_logs: [{ id, actor_user_id, actor_email, action, entity_type, entity_id, metadata, created_at }], total, limit, offset }`. Actions written today: `user.update`, `booking.cancel`, `payment.refund`, `refund.retry`, `markup_rule.create`, `markup_rule.update`, `ledger.adjustment`, `support_ticket.update` |
| `GET /admin/support/tickets?status=&limit=&offset=` | Support queue: `{ tickets: [ticket view + { user_id, user_email }], total, limit, offset }` |
| `PATCH /admin/support/tickets/:id` | `{ status?: "open" \| "in_progress" \| "resolved", admin_note?: ≤ 4000 }` → ticket view; audited; `404` |

> Note: `GET /admin/health/duffel` does not report Duffel's outbound rate-limit headroom; `duffel.configured` is derived from the presence of `DUFFEL_API_KEY`, not an auth probe.

## 9. Ledger 🛡 (`LedgerController`, mounted at `/admin/ledger`)

Internal money-movement ledger. Amounts are integer minor units, **signed** (inflow +, outflow −); `currency` is stored uppercase. `entry_type` ∈ `customer_payment | gateway_refund | supplier_charge | supplier_refund | adjustment`; `supplier` ∈ `duffel` or `null`.

| Method & path | Purpose |
|---|---|
| `GET /admin/ledger?entry_type=&currency=&booking_id=&limit=&offset=` | Newest first → `{ entries: [{ id, entry_type, amount, currency, supplier, payment_id, booking_id, booking_reference, refund_id, note, created_at }], total, limit, offset }`. `booking_id` must be a UUID |
| `GET /admin/ledger/summary` | Bare array `[{ currency, net_position, duffel_wallet_estimate }]` — `net_position` = sum of all entries, `duffel_wallet_estimate` = sum of entries tagged `supplier = duffel`; substitutes for Duffel's missing balance API, reconcile vs dashboards manually |
| `POST /admin/ledger/adjustment` | Manual reconciliation entry `{ amount: int (signed), currency: 3 chars, supplier?: "duffel", booking_id?: uuid, note: string ≤ 500 (required) }` → the created entry `{ id, entry_type: "adjustment", amount, currency, supplier, payment_id: null, booking_id, refund_id: null, note, created_at }`; writes an `AuditLog` row (`ledger.adjustment`) |

## 10. Health 🔓

`GET /health` — **unprefixed** (excluded from `/api/v1`) for load-balancer/container probes. `@nestjs/terminus` check of the database (TypeORM ping) and Redis (`PING`). When both are up: `200` with the Terminus envelope `{ status: "ok", info: { database: {status: "up"}, redis: {status: "up"} }, error: {}, details: {…} }`. Subject to the global rate limit.

> Note: when a check fails, Terminus throws a `ServiceUnavailableException` whose payload has no `code` field, so `GlobalExceptionFilter` renders it as the generic envelope `503 { "error": { "code": "SUPPLIER_UNAVAILABLE", "message": "Service Unavailable Exception", "details": {} } }` — the per-check `details` are **not** returned to the probe.

---

## Appendix — endpoint → state-machine transition map

| Transition | Triggered by |
|---|---|
| T1 `→ pending` | `POST /bookings` |
| T2 `pending → awaiting_payment` | `PUT /bookings/:id/passengers` |
| T3 `pending/awaiting_payment → failed` | Expiry sweep (`ExpirySweepService`); inline at `PUT /bookings/:id/passengers` or `POST /bookings/:id/payment-intent` when the snapshot has expired |
| T4 `awaiting_payment → paid` | `POST /webhooks/paymob` (`transaction.succeeded`, via `payment_webhook_queue`) |
| T5 `paid → confirmed` | Order-fulfillment worker after T4, or `POST /webhooks/duffel` `order.created` / reconciliation sweep |
| T6 `paid → order_failed` | Order-fulfillment worker (definitive supplier failure) / reconciliation sweep — never an HTTP endpoint |
| T7 `confirmed → cancelled` | `POST /bookings/:id/cancel` (auto-approvable) or `POST /admin/bookings/:id/cancel` |
| T8 / T9 `cancelled / order_failed → refunded` | `refund_execution_queue` worker once succeeded refunds cover the payment (enqueued by T7, T6, `POST /admin/refunds/:id/retry`; `POST /admin/payments/:id/refund` executes inline) |
