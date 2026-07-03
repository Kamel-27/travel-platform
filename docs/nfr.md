# TravelHub — Non-Functional Requirements (Phase 1)

**Status:** Draft v1
**Inputs:** [prd.md](prd.md) §8 (NFR summary this doc expands), [erd.md](erd.md), [duffel_api_integration_guide.md](duffel_api_integration_guide.md), [auth_flow.md](auth_flow.md).

Each section states the requirement, the mechanism, and (where testable) the number. Portfolio-project posture: these are real requirements sized honestly — no pretend five-nines.

---

## 1. Security & sessions

- Token strategy as specified in [auth_flow.md](auth_flow.md) §4: 15-min JWT access, 30-day rotating httpOnly refresh with reuse detection. No passwords, no password storage, no reset flow — that entire attack surface doesn't exist.
- All secrets (Duffel key, Stripe keys, webhook secrets, JWT signing key) via environment/host secret manager; never in the repo. Test-mode keys only until a live gateway exists (PRD §4).
- Standard HTTP hardening on the API: helmet-style headers, strict CORS (frontend origin only), request body size limits, `X-Request-Id` on every response.
- **Webhook endpoints verify signatures before touching the DB** (Stripe-Signature; Duffel's signing secret). Unsigned/invalid → 400, no side effects, no event row.
- Input validation at the DTO layer (NestJS pipes) on every endpoint — the per-passenger Duffel field rules from the API contract are validated server-side, never trusted from the client.

## 2. PCI scope

Target: **SAQ-A** (smallest possible scope). Card data is entered into Stripe Elements in the browser and goes directly to Stripe; the backend sees PaymentIntent ids and webhook events only. Consequently: no PAN, CVV, or expiry ever transits or rests in TravelHub systems; `PaymentAttempt.method` stores a category string ("card"), never card details; logs must never contain Stripe client secrets. Adding Paymob/Moyasar later must preserve this posture (hosted/iframe capture) or explicitly re-open the assessment.

## 3. Rate limiting — inbound and outbound

- **Outbound to Duffel** (the hard limit: 120 req/60s on search, live mode, per-endpoint budgets): Redis token bucket shared across backend instances (integration guide §7.4). On empty bucket → `429 RATE_LIMITED` to the client rather than blowing the supplier budget. Search cache (TTL ≤ 2 min, ≤ min remaining `expires_at`) is the first line of defense.
- **Inbound**: per-IP and per-user sliding-window limits on the expensive/abusable endpoints — `/flights/search` (e.g. 30/min/user), `/auth/magic-link/request` (3/15min/email + IP cap, per auth_flow §3), booking creation (idempotency lock already throttles doubles). Admin endpoints exempt but audited.

## 4. Consistency & integrity (mechanisms, cross-referenced)

The load-bearing set, defined authoritatively elsewhere, restated here as *requirements*:

- Booking status transitions only via [booking_state_machine.md](booking_state_machine.md), under row locks, each writing `BookingStatusHistory` in-transaction.
- Money invariants in the DB (`total = base + markup` CHECK; unique constraints on payments/attempts/events/orders per ERD) — the database is the last line of defense, not the service code.
- Webhook processing idempotent (unique event ids) and eventually complete (reprocessing worker over `processed_at IS NULL`).
- Duffel order creation: 130s client timeout, no blind retries, reconciliation via metadata-echoed idempotency key (state machine §4).

## 5. Availability & graceful degradation

- Duffel slow/down → circuit breaker on the adapter: fail fast with `503 SUPPLIER_UNAVAILABLE` and a clear user-facing message ("flight search is temporarily unavailable"), never a hung spinner or a silent empty result (PRD §8).
- Queue jobs (emails, PDFs, webhook processing, reconciliation): BullMQ retries with exponential backoff, max 5 attempts, then dead-letter queue; DLQ depth is an admin-visible metric. A failed email/PDF job must never affect booking state.
- Single deployed environment (roadmap §5) — no HA target; the requirement is *honest failure*, not no failure: any component outage must degrade to a clear error, and no money/booking state may be corrupted by a mid-flight crash (guaranteed by §4 mechanisms, exercised by the E2E failure-path tests in roadmap §3).

## 6. Performance targets (p95, measured from the API)

| Operation | Target | Note |
|---|---|---|
| `/flights/search` (cache miss) | ≤ 6s | Dominated by Duffel; surface progressive UI client-side |
| `/flights/search` (cache hit) | ≤ 300ms | |
| Booking creation (T1) + offer revalidate | ≤ 3s | |
| Payment intent creation | ≤ 2s | |
| `paid` → `confirmed` (order + ticket) | ≤ 60s typical; state machine tolerates minutes | UI shows "finalizing" |
| Webhook ack | ≤ 500ms | Verify + insert + enqueue only |
| Webhook processing lag (event received → processed) | ≤ 60s | PRD success metric; admin dashboard |

## 7. Observability & audit

- Structured JSON logs with `request_id` correlation across API → queue jobs; booking id and event ids as log fields. **No PII in logs** — emails, phone numbers, and document numbers are redacted at the logger level; log Duffel/Stripe *ids*, not payloads.
- Metrics (the PRD §6 list is the requirement): payment success rate, offer-expiry abandonment, booking→ticket latency, webhook lag, DLQ depth, bookings stuck in `paid` (should be ~0 outside reconciliation windows — alert if a booking is `paid` > 30 min).
- `AuditLog` on every admin mutation and `BookingStatusHistory` on every transition are **non-optional** (service-layer enforced) — this is the PRD's traceability NFR made concrete.
- Raw webhook payloads retained in their event tables — replayable history for disputes and debugging.

## 8. Data protection & retention

- PII inventory: passenger names/DOB/contact + **identity document numbers** (the sensitive tier), user emails/phones. Access: booking owner and `technical_admin` only — enforced at the service layer; document numbers additionally masked in list views (`A•••••67`).
- At-rest encryption: managed-Postgres disk encryption (host-provided) is sufficient for Phase 1; column-level encryption for `document_number` is a noted Phase 2 hardening item, not a Phase 1 gate.
- Retention: bookings/payments/audit kept indefinitely (commercial records); `MagicLinkToken` rows purged 24h after expiry; raw webhook payloads kept 90 days then archived/pruned. Account deletion (user request): deactivate + anonymize `User` (email → tombstone), keep booking records (legal/financial reality) — documented so it's a policy, not an accident.
- Backups: managed Postgres daily snapshots (Railway/Render built-in), 7-day window. Redis is rebuildable state (cache/locks/queue) — no backup requirement; queue jobs must be safe to lose-and-reconcile (the reprocessing worker covers webhook jobs).

## 9. Compliance posture (stated, not aspirational)

Phase 1 is a test-mode portfolio deployment: no real payments, real PII only from test users. GDPR-grade tooling (export, erasure automation) is out of scope until real customers exist — but the schema and the §8 policies are shaped so adding it is procedural, not structural.
