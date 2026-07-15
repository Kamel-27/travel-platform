# TravelHub — API Contract (Phase 1)

**Status:** Draft v1
**Inputs:** [prd.md](prd.md) §5, [erd.md](erd.md), [booking_state_machine.md](booking_state_machine.md) (transitions T1–T9 mapped to endpoints below).

Conventions first, then one endpoint group per functional area. This is the human-readable contract; the machine-readable OpenAPI spec is generated from NestJS `@nestjs/swagger` decorators at implementation time (M2+) and must match this document — divergence is a bug in the code, not the doc.

---

## 0. Conventions

- **Base path:** `/api/v1`. JSON only.
- **Auth:** `Authorization: Bearer <access token>` (see [auth_flow.md](auth_flow.md)). Endpoints marked 🔓 are public, 👤 need a user session, 🛡 need `technical_admin`.
- **Money:** integer minor units + ISO 4217 `currency`, everywhere, matching the ERD. `{"amount": 154200, "currency": "USD"}` = $1,542.00.
- **Times:** flight times are local wall-clock with IANA timezone (`{"local": "2026-08-01T09:15:00", "timezone": "Africa/Cairo"}`); system timestamps are UTC ISO 8601.
- **Errors:** one envelope, always:

```json
{ "error": { "code": "OFFER_EXPIRED", "message": "human-readable", "details": {} } }
```

Codes used below: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `OFFER_EXPIRED` (409), `ILLEGAL_TRANSITION` (409), `PAYMENT_REQUIRED` (402), `SUPPLIER_UNAVAILABLE` (503), `RATE_LIMITED` (429).
- **Pagination:** `?limit=` (default 20, max 100) + `?cursor=`; responses carry `{"data": [...], "next_cursor": "…" | null}`.
- **Idempotency:** `POST /bookings` accepts an optional client `Idempotency-Key` header (double-click guard, backed by the Redis lock from the integration guide §7).

---

## 1. Auth 🔓

| Method & path | Purpose |
|---|---|
| `GET /auth/google` | Redirect to Google (state + PKCE) |
| `GET /auth/google/callback` | Code exchange → find-or-create user + `AuthIdentity` → session |
| `POST /auth/magic-link/request` | `{"email": "…"}` → always `202` (no account enumeration); sends link if allowed by rate limits |
| `POST /auth/magic-link/verify` | `{"token": "…"}` → session, or `401 { "code": "TOKEN_INVALID" }` for expired/used/unknown (uniform) |
| `POST /auth/refresh` | Rotate refresh token (httpOnly cookie) → new access token |
| `POST /auth/logout` | Revoke refresh token |
| `GET /me` 👤 | `{ id, email, full_name, phone, role }` |

Session response shape (google callback + verify + refresh): `{ "access_token": "…", "expires_in": 900, "user": { … } }` — refresh token set as httpOnly cookie only, never in the body.

## 2. Flight search 🔓

**`GET /flights/search?origin=CAI&destination=RUH&departure_date=2026-08-01&return_date=&adults=1&children=0&infants=0&cabin_class=economy`**

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
    "conditions": { "refund_before_departure": { "allowed": true, "penalty": { "amount": 30000, "currency": "USD" } } }
  }],
  "next_cursor": null
}
```

`total` **includes markup** — the customer-facing price is the only price this API ever shows. `503 SUPPLIER_UNAVAILABLE` when Duffel is down (NFR graceful degradation); `429 RATE_LIMITED` when the outbound budget is exhausted.

**`GET /flights/offers/:offer_id`** — revalidates against Duffel (fresh `expires_at`, price re-check) and returns the same shape + `available_services`. Called at selection; `410 OFFER_EXPIRED` if gone.

## 3. Bookings 👤

| Method & path | State machine | Purpose |
|---|---|---|
| `POST /bookings` | T1 | `{"offer_id": "…"}` → creates `pending` booking + snapshot; body returns booking with `passenger_requirements` (which fields, whether ID docs needed) |
| `PUT /bookings/:id/passengers` | T2 | Full passenger list (shape below) → `awaiting_payment`; `400 VALIDATION_ERROR` lists per-passenger field errors |
| `GET /bookings` | — | Own bookings, newest first (index `user_id, created_at`) |
| `GET /bookings/:id` | — | Full detail: status, PNR, snapshot summary, passengers, payment summary, documents, schedule-change flag |
| `GET /bookings/:id/cancellation-quote` | pre-T7 | `{ refundable, penalty, customer_receives: {amount, currency}, requires_admin: bool }` from stored snapshot conditions |
| `POST /bookings/:id/cancel` | T7 | Executes auto-approvable cancellation; otherwise files an admin request (`202`) |

Passenger input shape (Duffel-verified required set):

```json
{ "type": "adult", "title": "mr", "gender": "m",
  "given_name": "Ahmed", "family_name": "Hassan", "date_of_birth": "1990-04-12",
  "email": "a@example.com", "phone_number": "+201001234567",
  "responsible_adult_index": null,
  "document": { "type": "passport", "number": "A1234567", "expiry": "2030-01-01", "nationality": "EG" } }
```

`document` required only when the snapshot says so; `responsible_adult_index` required for infants. Status is read-only via the API — **no endpoint sets `Booking.status` directly**; it only moves via the transitions above and webhooks.

## 4. Payments 👤

| Method & path | State machine | Purpose |
|---|---|---|
| `POST /bookings/:id/payment-intent` | pre-T4 | Creates/retries a `PaymentAttempt` → `{ provider: "stripe", client_secret, amount, currency }`. Guards: status is `awaiting_payment`, offer unexpired (`409 OFFER_EXPIRED` → booking fails per T3). Retry after a failed attempt returns a **new** intent |
| `GET /bookings/:id/payment` | — | Rollup + attempts + refunds (amounts, statuses, failure reasons) |

Card data never touches this API (Stripe Elements client-side; PCI SAQ-A per [nfr.md](nfr.md)).

## 5. Webhooks 🔓 (signature-verified, not session-auth)

| Method & path | Verification | Behavior |
|---|---|---|
| `POST /webhooks/stripe` | `Stripe-Signature` | Insert `PaymentWebhookEvent` (unique `provider`+`provider_event_id`), ack `200` fast, process via queue. Drives T4, T8, T9 |
| `POST /webhooks/duffel` | Duffel signature header | Insert `SupplierWebhookEvent` (dedupe on event `id` `wev_…`, store `idempotency_key` as `supplier_resource_id`), ack fast, queue. Drives T5 reconciliation + schedule changes |

Duplicate delivery → `200` (unique-violation caught, acked, not reprocessed). Signature failure → `400`, no insert.

## 6. Documents 👤

`GET /bookings/:id/documents` → `[{ id, source, type, supplier_document_id, file_url }]`; `GET /documents/:id/download` → short-lived signed blob URL redirect (owner or admin only).

## 7. Admin 🛡

| Method & path | Purpose |
|---|---|
| `GET /admin/users`, `PATCH /admin/users/:id` | List/deactivate users |
| `GET /admin/bookings?status=&user_id=&reference=` | All bookings; filter by PNR for support |
| `POST /admin/bookings/:id/cancel` | T7 for non-auto-approvable cases; also creates + enqueues the customer refund (supplier refund + full markup) → `{..., refund: {id, status} \| null}` |
| `POST /admin/payments/:id/refund` | Manual refund `{amount, reason}`; executes inline — a gateway failure leaves a `failed` Refund row (retryable) |
| `GET /admin/refunds?status=&limit=&offset=` | Refund pipeline monitor; `status=failed` lists retry candidates |
| `POST /admin/refunds/:id/retry` | Re-enqueue a failed/stuck refund (`409` if already succeeded) |
| `GET /admin/markup-rules`, `POST /admin/markup-rules`, `PATCH /admin/markup-rules/:id` | Configure markup; activating one deactivates the previous (partial unique index backstop) |
| `GET /admin/health/duffel` | Auth status, recent error rate, outbound rate-limit headroom, webhook processing lag, count of bookings stuck in `paid` |
| `GET /admin/metrics` | Overview dashboard: bookings by status (+ pending cancellation requests), charged/refunded/net per currency, pending/failed refund counts, user counts |
| `GET /admin/audit-logs?entity_type=&entity_id=&action=&actor_user_id=` | Read side of the audit trail, newest first, with actor email |
| `GET /admin/ledger?entry_type=&currency=&booking_id=&limit=&offset=` | Internal money-movement ledger (`customer_payment` / `gateway_refund` / `supplier_charge` / `supplier_refund` / `adjustment`), newest first; amounts in integer minor units, signed (inflow +, outflow −) |
| `GET /admin/ledger/summary` | Per-currency `{net_position, duffel_wallet_estimate}` — wallet estimate = sum of `supplier`-tagged entries; substitutes for Duffel's missing balance API, reconcile vs dashboards manually |
| `POST /admin/ledger/adjustment` | Manual reconciliation entry `{amount, currency, supplier?, booking_id?, note}` (signed minor units); writes an `AuditLog` row |

Every admin mutation writes an `AuditLog` row — enforced in the service layer, not optional per endpoint.
