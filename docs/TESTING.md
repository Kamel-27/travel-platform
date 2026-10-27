# TravelHub — Testing

**Status:** Written from code 2026-10-27 (main @ b176f47)

What test layers exist, how to run each one locally, what each proves and does not prove, the gates CI enforces, and the gaps that matter most for a money-handling system. Paths are relative to the repo root unless stated. See [ARCHITECTURE.md](ARCHITECTURE.md) for the system these tests cover.

---

## 1. The layers

| Layer | Runner | Lives in | Needs | Count at this commit |
|---|---|---|---|---|
| Backend unit / service specs | Jest 30 + ts-jest, `testEnvironment: node` | `app/Backend/src/**/*.spec.ts` | Nothing external — every repository, `EntityManager`, queue, Redis client and supplier service is mocked by hand | 31 spec files, 208 `it` blocks |
| Backend e2e smoke | Jest with `app/Backend/test/jest-e2e.json` + supertest | `app/Backend/test/app.e2e-spec.ts` | Real Postgres 16 + Redis 7 (`docker-compose.yml`), migrations applied | 1 file, 7 tests |
| Web unit / component | Vitest 4 + Testing Library in jsdom | `app/web/src/**/*.test.{ts,tsx}` | Nothing external — `fetch` is stubbed per test | 15 files, 201 tests |
| Web e2e smoke | Playwright 1.62, Chromium only | `app/web/e2e/*.spec.ts` | A production build of the web app; every `/api/v1` call intercepted — no backend | 3 files, 13 tests |

Config files: `app/Backend/package.json` (`"jest"` block), `app/Backend/test/jest-e2e.json`, `app/web/vitest.config.mts`, `app/web/vitest.setup.ts`, `app/web/playwright.config.ts`.

---

## 2. Running each layer locally

### 2.1 Backend unit specs

```bash
cd app/Backend
npm test               # jest, every src/**/*.spec.ts
npm run test:cov       # same, with coverage and the thresholds below
npm run test:watch
npm run test:debug     # --inspect-brk, --runInBand
```

No `.env` is needed; specs construct services with `Test.createTestingModule` and `useValue` mocks. The Paymob amount converter checks `process.env.JEST_WORKER_ID` and passes amounts through unchanged under Jest (`src/payments/services/paymob.service.ts` `toPaymobGatewayAmount`), so specs see pass-through values.

### 2.2 Backend e2e smoke (real Postgres + Redis)

Start the datastores from the repo root, apply migrations, run the suite. The environment below is copied from the `backend-e2e` job in `.github/workflows/ci.yml` and matches `docker-compose.yml`:

```bash
# repo root
docker compose up -d                      # postgres:16-alpine on 5432, redis:7-alpine on 6379

cd app/Backend
export NODE_ENV=test
export DATABASE_URL=postgresql://travelhub:travelhub@localhost:5432/travelhub
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=ci-e2e-secret-not-used-anywhere-real
export WEB_APP_URL=http://localhost:3000

npm run migration:run
npm run test:e2e
```

On PowerShell use `$env:NODE_ENV = "test"` and so on. `app/Backend/.env.example` already carries the same `DATABASE_URL`/`REDIS_URL`, so copying it to `.env` works too (`data-source.ts` loads `dotenv`; the Nest `ConfigModule` reads the process environment and `.env`).

The suite boots the real `AppModule` once in `beforeAll` and mirrors the global setup from `src/main.ts` by hand (helmet, cookie-parser, `ValidationPipe`, `GlobalExceptionFilter`, `api/v1` prefix). If `main.ts` changes, update the test or it stops testing what production serves (the file comment says the same).

> Note: because it boots the full module, `ScheduleModule` crons and BullMQ workers register against the local Redis for the duration of the run. On an empty database they are no-ops, but do not point `DATABASE_URL` at anything you care about.

### 2.3 Web unit / component tests

```bash
cd app/web
npm test               # vitest run
npm run test:cov       # with v8 coverage and thresholds
npm run test:watch
```

`vitest.config.mts`: `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]`, `resolve.tsconfigPaths: true` for the `@/` alias.

### 2.4 Web e2e smoke (Playwright)

```bash
cd app/web
npx playwright install --with-deps chromium   # first time
npm run test:e2e
```

`playwright.config.ts` starts `npm run build && npm run start -- --port 3100` as the web server (5-minute timeout, `reuseExistingServer` outside CI) with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3100`, so the app's own origin receives the API calls and the specs intercept them with `page.route`. `e2e/api-mock.ts` installs a catch-all for `**/api/v1/**` returning `{ data: [], next_cursor: null }` first, then specific handlers for `/auth/refresh` (session or 401) and `/flights/search*` (offers, or a 502 envelope). The report lands in `app/web/playwright-report/`.

---

## 3. What each layer proves, and what it does not

| Layer | Proves | Does not prove |
|---|---|---|
| Backend unit specs | Branch logic of the services in isolation: legal/illegal transitions and replay no-ops (`booking-state-machine.service.spec.ts`), both exits from `paid` applying once under a mocked row lock (`fulfillment-outcome.service.spec.ts`), T4 processing and post-commit enqueue (`payment-webhook.processor.spec.ts`), refund validation and idempotent execution (`refund-execution.service.spec.ts`), reconciliation decisions (`duffel-reconciliation.service.spec.ts`), webhook signature and dedup handling (`webhooks.controller.spec.ts`, `duffel-webhooks.controller.spec.ts`), Duffel normalisation and error classification (`duffel.service.spec.ts`), token rotation and family revocation (`token.service.spec.ts`), the error envelope, logger and request-id plumbing. | That the SQL, locks, unique constraints, transactions and TypeORM query-builder chains behave the way the mocks assume. The mocks replay `setLock().where().getOne()` and `23505` error codes by hand, so a wrong lock or a missing unique index would not fail here. Nothing about real Redis, real BullMQ delivery, or cron scheduling. |
| Backend e2e smoke | The app starts: DI graph resolves, Joi env validation passes, TypeORM and Redis connect, BullMQ queues register; `GET /health` is 200 with `database` and `redis` up and is not reachable under `/api/v1`; helmet headers present; unknown routes return the standard envelope; `/me` returns 401 without or with a malformed bearer token. | Any business flow. It never creates a booking, never sends a webhook, never touches a queue job. |
| Web unit / component | `api-client.ts` (bearer attach, single-flight 401 refresh + retry, 204/no-JSON handling, timeout and network errors mapped to `ApiError`, blob downloads), `auth-context.tsx` rehydration and logout, `token-store.ts`, `money.ts` minor-unit decimals, `datetime.ts` wall-clock parsing under a non-UTC `TZ`, `return-path.ts`, `airports.ts`; component behaviour for the seven shared components and the `manage-bookings` redirect page. | Any route page except `manage-bookings`; the real router; styling/RTL rendering; anything against a running backend. Coverage is deliberately scoped to `src/lib/**` and `src/components/**` (see §4). |
| Web e2e smoke | The production bundle builds and boots; the landing search card renders and carries its state into `/flights?…`; airport swap, destination tiles and autocomplete work; `/flights` renders an offer from the (mocked) API, maps the URL query onto the API contract, shows the empty state and a retryable error; the legacy `/manage-bookings` URL redirects by role; the header reflects a session restored from the refresh cookie on a cold load, and the sign-in CTA when there is none. | Checkout, payment, bookings, admin — none of those pages are driven. No real API, no CORS, no cookies from a real backend, no Paymob iframe. |

---

## 4. Coverage gates

| Suite | Scope of the measurement | Thresholds (all must pass) | Where |
|---|---|---|---|
| Backend | `collectCoverageFrom: ["**/*.(t|j)s"]` under `src/` — every source file including entities, DTOs, migrations, `main.ts` and `instrument.ts`, which is a large part of why the numbers are low | statements 55, branches 47, functions 45, lines 55 | `app/Backend/package.json` `jest.coverageThreshold.global` |
| Web | `include: ["src/lib/**", "src/components/**"]`, `exclude: ["src/lib/types.ts"]`; route pages are excluded on purpose because Playwright covers them | statements 90, branches 85, functions 90, lines 90 | `app/web/vitest.config.mts` `test.coverage.thresholds` |

The last committed backend `coverage/lcov.info` (2026-10-09) totals about 59% lines, 52% branches, 50% functions — a few points above the gate. The web config comment records the suite at roughly 97/90/96/99, with the gate set a little under so an untested addition trips it without every refactor doing so.

Both gates run in CI (`npm run test:cov`) and fail the job when a threshold is missed.

---

## 5. CI jobs (`.github/workflows/ci.yml`)

Triggered on pull requests to `main` and pushes to `main`. All on `ubuntu-latest`, Node 22, `npm ci` with the lockfile cached.

| Job | Working dir | Steps | Datastores |
|---|---|---|---|
| `web` — Web (lint, typecheck, build, unit tests) | `app/web` | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:cov` | none |
| `web-e2e` — Web (e2e smoke) | `app/web` | `npx playwright install --with-deps chromium`, `npm run test:e2e`; uploads `playwright-report/` as an artifact on failure (7 days) | none |
| `backend` — Backend (lint, typecheck, build, unit tests) | `app/Backend` | `npm run lint:check`, `npm run typecheck`, `npm run build`, `npm run test:cov` | none |
| `backend-e2e` — Backend (e2e smoke) | `app/Backend` | `npm run migration:run`, `npm run test:e2e` with the env vars in §2.2 | GitHub service containers `postgres:16-alpine` and `redis:7-alpine` with health checks |

`.github/workflows/deploy-backend.yml` re-runs the backend lint/typecheck/build/`test:cov` sequence before SSHing to the VM; it does not run the backend e2e suite.

---

## 6. Stack gotchas worth keeping

- **`TZ` is pinned to `America/Los_Angeles`** in `app/web/vitest.setup.ts`. Flight times are local wall-clock strings that must never be UTC-normalised; a non-UTC zone makes a regression in `datetime.ts` fail locally instead of passing by luck on a UTC runner. Do not remove it, and do not write assertions that depend on the host zone.
- **Fake timers need `shouldAdvanceTime: true`.** Components that debounce or poll are tested with `vi.useFakeTimers({ shouldAdvanceTime: true })` (`AirportInput.test.tsx`, `CancelBookingModal.test.tsx` around line 247) so stubbed `fetch` promises and Testing Library's own `waitFor` keep moving while you `advanceTimersByTime`. Plain `useFakeTimers()` hangs those tests.
- **Never reuse a `Response` across mocked `fetch` calls.** A `Response` body can be read once; the tests build a fresh one per call through small helpers (`jsonResponse` / `errorResponse` in `api-client.test.ts`, `AirportInput.test.tsx`, `CancelBookingModal.test.tsx`, `auth-context.test.tsx`) and use `mockResolvedValueOnce` sequences rather than one shared object.
- **Globals are stubbed, not patched.** `vi.stubGlobal("fetch", …)` per test; `vitest.setup.ts` runs `cleanup()`, `vi.restoreAllMocks()` and `vi.unstubAllGlobals()` after every test, and polyfills `Element.prototype.scrollIntoView` and `window.matchMedia`, which jsdom lacks and components call during render.
- **In-memory token store is module state.** `token-store.ts` keeps the access token in a module variable; tests that depend on a signed-out state should set it explicitly rather than assume a fresh module.
- **Next.js 16 is not the Next.js in most training data.** `app/web/AGENTS.md` (included by `CLAUDE.md`) says to read `node_modules/next/dist/docs/` before writing framework code; that applies to tests that touch `next/navigation` or route files.
- **Backend specs mock TypeORM chains by hand.** The pattern (see `fulfillment-outcome.service.spec.ts`): a `lockQuery` object with `setLock`/`where` returning `this` and `getOne` resolving the current fixture, a `manager.getRepository(cls)` switch, and `getQueueToken(QUEUE)` for BullMQ queues. Copy an existing spec rather than reaching for an in-memory database — there is none wired up.
- **Paymob conversion is bypassed under Jest** (`JEST_WORKER_ID` check in `toPaymobGatewayAmount`). Unit tests therefore never exercise the sandbox EGP conversion path.
- **The backend e2e suite mirrors `main.ts` manually** (§2.2); global middleware added to `main.ts` is invisible to it until copied over.
- **Playwright route precedence is last-registered-wins.** `e2e/api-mock.ts` registers the catch-all first on purpose; add specific routes after calling `mockApi`, not before.

---

## 7. Gaps

What is not tested today, in order of how much money it could cost:

1. **No integration test of webhook replay against a real database.** The dedup relies on the composite unique constraints on `payment_webhook_events` and `supplier_webhook_events` plus the `processed_at` lock-and-check in the processors. Unit specs simulate the `23505` error and the lock; nothing proves the constraints exist in the migrations or that two concurrent deliveries resolve to one `paid` transition.
2. **No test of the payment-return race.** The Paymob webhook can arrive before `POST /bookings/:id/payment-intent` has committed the `PaymentAttempt`; the processor throws and the minute sweep retries. That timing is reasoned about in comments, not exercised.
3. **No test of refund idempotency with real locks.** `executeRefund` re-reads the row under `pessimistic_write` and no-ops unless `pending`; the BullMQ 5-attempt backoff plus the admin retry plus the requeue sweep can all target one refund. Only the single-process branch logic is covered.
4. **No test of the `paid → confirmed` versus `paid → order_failed` fork with three racing callers** (synchronous `createOrder`, `order.created` webhook, reconciliation) against a real row lock.
5. **Backend coverage gates are low** — 55/47/45/55 — and the measurement includes entities, DTOs and migrations, so a drop in a money path can hide behind unchanged boilerplate.
6. **Web pages are untested below the smoke level**: checkout, payment polling, confirmation, bookings detail and every admin page have neither unit tests nor Playwright coverage.
7. **The backend e2e suite does not exercise auth beyond 401s**: no magic-link verify, no refresh rotation, no family revocation, no admin 403.

### How a new money-path test should be structured

The missing layer is a DB-backed integration spec. Keep it inside the existing tooling:

1. **Put it under `app/Backend/test/` with the `.e2e-spec.ts` suffix** so `test/jest-e2e.json` (`testRegex: ".e2e-spec.ts$"`) picks it up and the CI `backend-e2e` job runs it with the real Postgres and Redis service containers. No new runner, no new workflow.
2. **Boot `AppModule` once per file** as `app.e2e-spec.ts` does, but **override the external edges** with `Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DuffelService).useValue(fakeDuffel).overrideProvider(PaymobService).useValue(fakePaymob).overrideProvider(MailService).useValue(fakeMail)`. Everything inside the boundary — TypeORM, locks, constraints, `BookingStateMachineService`, `FulfillmentOutcomeService`, `RefundExecutionService`, `LedgerService` — stays real.
3. **Seed through the `DataSource`**, not through HTTP: insert a `User`, a `Booking` in the state under test, its `FlightOfferSnapshot`/`Passenger` rows, a `Payment` and `PaymentAttempt` with the `providerReferenceId` the fake webhook will carry. Truncate the tables (or wrap each test in a transaction you roll back) in `afterEach`.
4. **Drive the unit of work directly, not the queue.** Get the processor from DI (`app.get(PaymentWebhookProcessor)`) and call `process({ data: { eventId } } as Job)` — or call `FulfillmentOutcomeService.confirmPaidBooking` / `failPaidBookingAndRefund` inside `entityManager.transaction`. That makes the test deterministic and keeps BullMQ workers out of the critical path; stub the injected `Queue.add` with `jest.spyOn` and assert it was called after the transaction, not during.
5. **Assert on rows, then replay.** After the first run, read back `bookings.status`, `booking_status_history`, `payments.status`, `ledger_entries` and `refunds` with the repository. Then run the same call again (same webhook event id, same refund id) and assert the row counts did not change and the status did not move — the replay is the actual property under test.
6. **For the fork and the race, run two calls concurrently** with `Promise.all` on two separate `EntityManager.transaction` blocks (the pool gives each its own connection), and assert exactly one `supplier_charge` ledger row and exactly one `Document` set, or exactly one `Refund` row, exists afterwards.
7. **Keep money as integers in fixtures** and assert the check constraint by trying to insert `total != base + markup` once, so the gate is proven, not assumed.

A first target with the best cost/benefit: a webhook-replay spec that posts the same Paymob transaction twice through `WebhooksController.handlePaymobWebhook` (HMAC computed with a test `PAYMOB_HMAC_SECRET`), processes both events, and asserts one `paid` transition, one `customer_payment` ledger row and one enqueued fulfillment job.
