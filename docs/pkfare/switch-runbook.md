# PKFare Cutover Runbook

How to switch production from Duffel to PKFare, disable Duffel, and roll back — **without
affecting existing bookings or critical logic**. Prerequisite: Phases 1–3 of
[integration-guide.md](./integration-guide.md) are merged and the PKFare adapter is live but
dormant (`FLIGHT_PROVIDER=duffel`).

## Key safety property

Provider selection (`FLIGHT_PROVIDER`) only governs **new** bookings. Every existing booking, its
cancellation, refund, ticket lookup, and reconciliation resolves the supplier from its stored
`booking.supplier` column — **not** the global flag. So flipping to PKFare leaves in-flight Duffel
bookings fully operational.

---

## 1. Pre-cutover checklist

- [ ] `PKFARE_PARTNER_ID` / `PKFARE_PARTNER_KEY` obtained from the account manager and set in the
      production environment.
- [ ] Prepaid **wallet funded** with enough balance for expected ticketing volume.
- [ ] Migration applied: `supplier_provider` enum contains `pkfare`
      (`AddPkfareSupplier` migration ran).
- [ ] `TicketIssuanceNotify_V2` push URL (`https://api.safariyat.live/api/v1/webhooks/pkfare`)
      registered with PKFare; inbound auth scheme confirmed (`TODO(pkfare-verify)`).
- [ ] On **staging** with `FLIGHT_PROVIDER=pkfare`: `GET /admin/metrics` shows PKFare configured
      and healthy; run the smoke test in §4.
- [ ] Sandbox base URL confirmed and end-to-end smoke test passed once.

---

## 2. The switch

1. Set `FLIGHT_PROVIDER=pkfare` in the production environment.
2. Restart the backend (or roll the deployment).
3. Verify `GET /admin/metrics`: active provider = `pkfare`, `configured = true`.
4. Run one live smoke booking (§4).

No code deploy is required for the flip itself — it is an env change + restart.

---

## 3. Disabling Duffel

- Leave `DUFFEL_API_KEY` / `DUFFEL_WEBHOOK_SECRET` **in place** so in-flight Duffel bookings keep
  reconciling, cancelling, and refunding via their stored `supplier=duffel`.
- New bookings automatically use PKFare (the active provider); no traffic is routed to Duffel for
  new orders.
- The `POST /webhooks/duffel` endpoint returns 404 while PKFare is active, so any late Duffel
  webhook cannot mutate state.
- Only remove the `DUFFEL_*` secrets once **all** Duffel bookings have reached a terminal state
  (confirmed-and-flown / cancelled / refunded) — check with an admin query on
  `bookings WHERE supplier='duffel' AND status NOT IN (terminal…)`.

---

## 4. Smoke test (staging and post-cutover)

Run the full flight through the real API on one cheap route:

1. `GET /flights/search` → returns PKFare-sourced offers (normalized shape unchanged).
2. `POST /bookings` (createBooking) → re-prices via `precisePricing`, stores booking `pending`.
3. `POST /bookings/:id/passengers` → `awaiting_payment`.
4. Complete payment (Paymob sandbox) → `paid`.
5. Fulfillment runs `preciseBooking → orderPricing → ticketing`; booking stays `paid`,
   `supplierOrderId` = PKFare `orderNum`.
6. Ticket issuance (`ISSED`) arrives via `POST /webhooks/pkfare` **or** the `orderDetail`
   reconciliation poll → booking `confirmed`, `Document` rows hold ticket numbers, PNR set.
   (On sandbox, force this with the `buyer/fake/modifyOrder` helper.)
7. `GET /bookings/:id/ticket.pdf` renders.
8. Cancel the booking → refund path executes (customer refund via Paymob queue; supplier
   reimbursement settles on `*_REIMED`).

---

## 5. Rollback

1. Set `FLIGHT_PROVIDER=duffel`.
2. Restart the backend.
3. New bookings use Duffel again; any PKFare bookings already created keep resolving via
   `supplier=pkfare`.

The `pkfare` enum value is additive and harmless — **no migration reversal is needed**. Rollback
is a pure env change.

---

## 6. Post-cutover monitoring

- `GET /admin/metrics` — PKFare request/error rates and the low-wallet-balance signal.
- Watch for bookings stuck in `paid` beyond the expected ticketing window (reconciliation sweep
  should clear them to `confirmed` or `order_failed`).
- Alert on repeated `RSV_FAIL` or insufficient-balance errors — the latter means top up the wallet.
