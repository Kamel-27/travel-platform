# PKFare Integration — Implementer Handover

Read this **before writing any code**. It captures the domain experience, the codebase's
non-negotiable conventions, and the specific traps that will otherwise bite you. It exists because
the implementation is done by a model that can't open PKFare's portal or infer this repo's
unwritten rules — everything you need is here or in the sibling docs.

**Reading order:** this file → [architecture.md](./architecture.md) →
[api-contracts.md](./api-contracts.md) → [integration-guide.md](./integration-guide.md). Keep
[duffel-coupling-and-gaps.md](./duffel-coupling-and-gaps.md) open as you work.

**Golden rule of this repo:** where a plan and `docs/api_contract.md` disagree, **the contract
wins.** The docs in `docs/` (`api_contract.md`, `booking_state_machine.md`, `erd.md`, `nfr.md`,
`sequence_diagrams.md`) are the source of truth; treat plan omissions as accidental, not license.

---

## 1. Domain model you must understand first

TravelHub is a B2B/B2C flight booking platform. A booking moves through a **state machine**
(`docs/booking_state_machine.md`, transitions labelled T1–T7):

```
pending ──T1(create)──▶ pending ──T2(passengers)──▶ awaiting_payment ──pay──▶ paid
   paid ──T5(order ok)──▶ confirmed        paid ──T6(order fail)──▶ order_failed (+auto-refund)
   confirmed ──T7(cancel)──▶ cancelled (+refund)     any ──expiry──▶ failed
```

Key entities (all already supplier-agnostic):
- **`Booking`** — money as **integer minor units** (`baseAmount`, `markupAmount`, `totalAmount`),
  a DB CHECK `ck_bookings_total_match` enforces `total = base + markup`, `supplier` enum,
  `supplierOrderId`, `supplierIdempotencyKey`, `bookingReference` (PNR).
- **`FlightOfferSnapshot`** — the frozen offer at booking time (`supplierOfferId`, price,
  `conditions`, `rawOffer`). For PKFare, `supplierOfferId` holds the `solutionId`.
- **`Passenger`** — `givenName`/`familyName`, `dateOfBirth`, doc fields, `supplierPassengerId`,
  `responsibleAdultPassengerId` (infant→adult).
- **`Document`** — issued e-tickets (ticket numbers).
- **`SupplierWebhookEvent`** — multi-supplier webhook inbox (dedupe + `processed_at` sweep).
- **`LedgerEntry`** — double-entry money ledger (signed minor units, inflow +, outflow −).

**How a booking actually flows (trace it in code):**
1. `flights.service.search()` → provider `search()`.
2. `bookings.service.createBooking()` → provider `fetchOffer()` (re-price), markup, store
   `Booking(pending)` + `FlightOfferSnapshot`.
3. `bookings.service.savePassengers()` → `awaiting_payment`.
4. Paymob payment → webhook → `paid` → enqueue fulfillment.
5. `order-fulfillment.service.fulfillOrder()` → provider `createOrder()` →
   `confirmed` (Duffel) or stays `paid` until ticketed (PKFare).
6. `order-reconciliation.service` sweep + webhook → `confirmed`/`order_failed`.

If you don't understand steps 4–6, re-read them before touching fulfillment.

---

## 2. Non-negotiable house conventions (breaking these = CI red or data corruption)

- **Money is integer minor units, everywhere.** PKFare returns **decimals** (`adtFare: 117.25`).
  You MUST convert to minor units in the adapter (reuse `decimalsForCurrency` from
  `duffel.service.ts` — handles JPY=0, KWD=3, etc.). A float in `totalAmount` violates
  `ck_bookings_total_match` and the insert fails.
- **Error envelope.** Throw NestJS exceptions with `{ code: ErrorCode.X, message }`. The
  `ErrorCode` enum (`src/common/dto/error-response.dto.ts`) is closed: use `SUPPLIER_UNAVAILABLE`
  (503), `OFFER_EXPIRED`, `ILLEGAL_TRANSITION`, `RATE_LIMITED`, `VALIDATION_ERROR`, etc. A global
  filter wraps them into `{ error: { code, message, details } }` — don't hand-roll that shape.
- **App must boot unconfigured.** Optional integrations use Joi `.allow('')` in the env schema and
  a runtime `assertConfigured()` that throws a clean `SUPPLIER_UNAVAILABLE` 503 (copy
  `DuffelService.assertConfigured()`). `FLIGHT_PROVIDER=pkfare` with empty creds must **boot** and
  return 503 on use — never crash on startup.
- **Migrations = house style.** Hand-written (never auto-generated blindly); explicit snake_case
  `name:` on every column; named constraints `ux_/ix_/fk_/ck_`; `foreignKeyConstraintName` on
  JoinColumns; `timestamptz`; uuid PKs. After writing: `npm run migration:run`, test
  `npm run migration:revert`, then a **zero-drift check** (`migration:generate` a throwaway must
  print "No changes" — delete it).
- **snake_case at the API boundary, camelCase in entities.** Controllers/DTOs return snake_case
  (see `mapBookingSummary`). Never return a raw camelCase entity to the frontend (a real bug found
  in a past review).
- **State only via the state machine.** Use `BookingStateMachineService.transitionTo(...)` (it's
  replay-safe and enforces legal transitions). Never `bookingRepo.update({status})` directly.
- **Commit trailer.** The implementer model commits with
  `Co-Authored-By: <your model> <noreply@anthropic.com>` and a detailed body.

---

## 3. Common mistakes — the checklist that will actually bite you

### Correctness / domain traps (high severity)

- [ ] **External HTTP calls inside a DB transaction.** NEVER wrap a PKFare `fetch` inside
  `entityManager.transaction(...)`. The codebase does the supplier call first, then a *short* DB
  transaction (see `bookings.service.cancelBooking` — comment: *"external call, never inside a DB
  transaction"*). Holding a DB tx open across a 130 s ticketing call will exhaust the pool.
- [ ] **Blind-retrying an ambiguous order.** On `preciseBooking`/`ticketing` timeout or
  **`B006` (message contains an OrderNum)**, `B012`/`B028` — the order **may exist**. Throw
  `ProviderAmbiguousError`, leave the booking in `paid`, and let reconciliation resolve it via
  `orderDetail`. Retrying creates **duplicate tickets** = real money lost.
- [ ] **Ignoring the 30-minute pricing→booking window.** ⚠️ PKFare requires `preciseBooking`
  within **30 min of `precisePricing`**, and `ticketing` within **30 min of `orderPricing`**.
  In this app, pricing happens at `createBooking` but ticketing happens **after the customer pays**
  — which can be far more than 30 min later. **Therefore PKFare `createOrder()` (in fulfillment)
  MUST re-run `precisePricing` → `preciseBooking` → `orderPricing` → `ticketing` fresh**, not
  reuse the stale `solutionId` from booking time. Reusing it → error `B005`. This is the single
  most likely thing to get wrong.
- [ ] **Decimal → minor-unit conversion errors.** See §2. Double-check round-trips in a unit test.
- [ ] **Storing `orderNum` too late.** Persist `data.orderNum` into `booking.supplierOrderId`
  **immediately** after `preciseBooking` returns (even before `ticketing`), so reconciliation can
  find it if the process dies mid-flight.
- [ ] **Wallet balance not handled.** `ticketing` `B022` = insufficient prepaid balance. Map to
  `ProviderDefinitiveError` (definitive → `order_failed` + auto-refund) and surface a low-balance
  signal in `getMetrics()`. Don't treat it as a transient retry.
- [ ] **Price-change on `orderPricing` (`B116`/`B113`).** Don't silently ticket at the new price.
  Abort → refund, matching how Duffel offer-expiry is handled.

### Infrastructure traps

- [ ] **Postgres enum migration.** Adding `'pkfare'` to the `supplier_provider` enum uses
  `ALTER TYPE supplier_provider ADD VALUE 'pkfare'`. Postgres will **not** let you *use* the new
  value in the same transaction that adds it, and TypeORM runs migrations in a transaction. Put the
  `ADD VALUE` in **its own migration**, separate from any migration that inserts/uses `'pkfare'`.
  If you hit `ALTER TYPE ... ADD VALUE cannot run inside a transaction block`, split it or disable
  that migration's transaction. **Verify locally** — you can't assume.
- [ ] **Forgetting to update `.spec.ts` mocks.** Every service that switches from injecting
  `DuffelService` to the `FLIGHT_PROVIDER` token has a spec mocking `DuffelService` — update those
  mocks or the suite goes red. The existing test suite is your Phase-1 correctness gate.
- [ ] **NestJS DI wiring.** If a module provides a service but doesn't `exports` it, consumers get
  a "Nest can't resolve dependencies" error. Wire `PkfareModule` into `FlightProviderModule` and
  export what's injected.
- [ ] **Missing outbound timeouts.** Every `fetch` to PKFare needs an `AbortSignal.timeout(...)`
  (30 s search/pricing, 130 s book/ticket) — fail-fast, never a hung spinner (`nfr.md §5`).
- [ ] **Secrets / PII in logs.** Never log the `partnerKey`, full passenger docs, or card numbers.
- [ ] **Frontend react-hooks (only if you touch web).** `eslint-plugin-react-hooks` 7.x flags
  `set-state-in-effect`. The established fix is an inline async IIFE:
  `void (async () => { await load(); })()` inside the `useEffect`. Calling a `useCallback` loader
  synchronously fails CI.

### Process traps

- [ ] **Not running the full CI gate before pushing.** CI = `npm run lint:check && npm run
  typecheck && npm run build && npm test` (in `app/Backend`). All four must be green. `lint:check`
  does **not** auto-fix — run `npm run lint` / `npm run format` first, then `lint:check`.
- [ ] **Committing broken mermaid.** `;` in a mermaid sequence-diagram message breaks rendering —
  validate any diagram with `npx -y @mermaid-js/mermaid-cli` before committing docs.
- [ ] **Assuming `gh` exists.** There is **no GitHub CLI** on this machine. Push the branch and
  give the user the compare URL: `https://github.com/Kamel-27/travel-platform/compare/main...<branch>?expand=1`.

---

## 4. Testing & verification (what "done" looks like)

**Unit tests (required, no DB):** mock repositories and Redis; feed the adapter the **example JSON
from [api-contracts.md](./api-contracts.md)** as fixtures and assert the `NormalizedOffer` /
`ProviderOrderResult` / `ProviderOrderStatus` mapping. Cover: decimal→minor-unit, infant linkage,
`ISSED`→confirmed, `RSV_FAIL`/`B022`→failed, `B006`→ambiguous.

**Live verification (do not skip — reading code is not verification):**
1. `npm run lint:check && npm run typecheck && npm run build && npm test` — all green.
2. `docker compose up --wait`, `cp .env.example .env` if needed, `npm run migration:run`, test
   `migration:revert`, run the drift check.
3. Boot `start:prod`; with `FLIGHT_PROVIDER` unset, confirm existing Duffel specs/flows unchanged.
4. With `FLIGHT_PROVIDER=pkfare` **unconfigured**, `GET /flights/search` returns a clean
   `SUPPLIER_UNAVAILABLE` 503 (app booted fine).
5. For admin-guarded endpoints, mint a JWT inline with `node` + `jsonwebtoken` and `JWT_SECRET`
   from `.env` (write the token inline in the curl, **not** via a file — a CR corrupts the header).
6. Sandbox end-to-end (once credentials exist): follow [switch-runbook.md §4](./switch-runbook.md);
   use `buyer/fake/modifyOrder` to force `ISSED` and prove `paid → confirmed` with ticket documents.

**PR checklist:** all four CI commands green · migration runs+reverts+zero-drift · specs updated ·
no secrets in diff · `app/Backend` behavior for Duffel unchanged when `FLIGHT_PROVIDER` unset ·
detailed commit body + `Co-Authored-By` trailer · compare URL handed to the user.

---

## 5. Domain search cheat-sheet (where things live)

| Need to find… | Look at |
|---|---|
| The 7 places Duffel is injected | [duffel-coupling-and-gaps.md §1](./duffel-coupling-and-gaps.md#part-1--current-duffel-coupling-points) |
| Money/currency conversion | `duffel.service.ts` → `toMinorUnits` / `decimalsForCurrency` |
| Booking state transitions | `bookings/services/booking-state-machine.service.ts`; `docs/booking_state_machine.md` |
| Paid-recovery matrix (definitive/ambiguous) | `order-fulfillment.service.ts`; `booking_state_machine.md §4` |
| Reconciliation confirm path | `duffel-reconciliation.service.ts` → `confirmBookingFromOrder` (shared, replay-safe) |
| Webhook ingest + dedupe | `duffel-webhooks.controller.ts`, `supplier-webhook-event.entity.ts` |
| Error codes / envelope | `common/dto/error-response.dto.ts`; `api_contract.md §0` |
| Rate limiting (token bucket) | `flights.service.ts` → `checkOutboundRateLimit`; `nfr.md §3` |
| Migration examples | `src/database/migrations/*` (copy the newest for conventions) |
| The verified PKFare wire formats | [api-contracts.md](./api-contracts.md) |

---

## 6. Environment & workflow facts

- **Machine:** Windows 11, Git Bash + PowerShell. Absolute paths. Backend runs on port **3001**,
  web on **3000**. `jq` is missing (use `node` or PowerShell `ConvertFrom-Json`).
- **Permissions:** the repo runs in unattended/bypass mode for long tasks — but that's about
  approvals, not correctness. Verify everything.
- **Branch flow:** feature branch → push → the user opens/merges the PR via GitHub UI. Keep
  branches one milestone-slice each (this integration is `refactor/flight-provider-port` then
  `feat/pkfare-adapter` per the roadmap — the abstraction refactor and the adapter can be separate
  PRs).
- **Blocked-on:** the live PKFare adapter is blocked on a PKFare commercial account + funded
  deposit. Everything except the live smoke test can be built and unit-tested now.

---

## 7. What to hand back / flag to the user

When you finish (or get blocked), report concretely: which phase is done, CI status with the actual
output, any `TODO(pkfare-verify)` you couldn't resolve (notify auth scheme, exact
`requestTicketing` schema, wallet error codes), and the compare URL. End with the single concrete
next step — the user asks "what next" and expects an ordered answer.
