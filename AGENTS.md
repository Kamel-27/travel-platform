# Working in this repo

Read this before changing anything. It is the operating manual for people and
coding agents alike; `CLAUDE.md` just points here.

## What this is

TravelHub (سفريات): a live Arabic-first flight-booking platform. Next.js 16 web
app in `app/web` (Vercel), NestJS 11 API in `app/Backend` (Azure VM, Docker
Compose + Caddy), Postgres 16, Redis 7 + BullMQ. Suppliers: Duffel (flights),
Paymob (payments), Resend (email). Error reporting: Sentry, env-gated.

Start with `docs/ARCHITECTURE.md`. It is written from the code and says what
each module owns, which queues and crons exist, and why the money paths are
shaped the way they are.

## Where truth lives

| Question | Look at |
|---|---|
| What endpoints exist, auth, shapes, error codes | `docs/api_contract.md` |
| Tables, columns, indexes, enums | `docs/erd.md` and the migrations in `app/Backend/src/database/migrations` |
| Legal booking / payment / refund transitions and their side effects | `docs/booking_state_machine.md`, `docs/sequence_diagrams.md` |
| Sign-in, tokens, roles | `docs/auth_flow.md` |
| Rate limits, logging, retention, PCI scope | `docs/nfr.md` |
| How to run and read the tests | `docs/TESTING.md` |
| How production is deployed and operated | `docs/deployment.md` |
| What comes next in the booking path | `docs/booking_flow_v2_plan.md` |

Every doc carries a `**Status:** Verified against code <date> (main @ <sha>)`
line. If the code and a doc disagree, the code is right and the doc is a bug:
fix the doc in the same PR. `docs/archive/` is history only.

## Rules that are not obvious from the code

- Money is integer minor units with an explicit currency column. Never float.
- Flight times are airport-local wall-clock strings. Never UTC-normalise them.
  The web test setup pins `TZ=America/Los_Angeles` so a UTC runner cannot hide
  a regression here.
- Every exit from booking status `paid` goes through
  `FulfillmentOutcomeService` under a row lock so it applies exactly once,
  whichever of webhook, fulfillment job or reconciliation sweep gets there first.
- "Retry" for webhook processing means the `processed_at IS NULL` sweep, not a
  BullMQ retry policy. No queue in this codebase configures job-level attempts
  except refund execution, which keeps its own attempt counter.
- `@CurrentUser()` yields a `JwtPayload` (`{ sub, role }`), never a `User`
  entity. Read `.sub`, not `.id`.
- `RolesGuard` is opt-in: an endpoint with no `@Roles()` metadata is allowed
  for any authenticated user. Admin controllers set it at class level. A new
  admin endpoint in a new controller must do the same.
- Roles are only `user` and `technical_admin`. The agency role model is not
  built.
- `AdminController` is `@SkipThrottle()`; everything else has the global
  per-IP limit, and flight search has its own tighter one. Numbers are in
  `docs/nfr.md`.
- Next 16 App Router error boundaries use `unstable_retry`, not `reset`. Folders
  prefixed with `_` are excluded from routing. Read `app/web/AGENTS.md` before
  writing App Router code; this Next version diverges from most training data.
- `eslint-plugin-react-hooks` 7 flags a sync `void load()` inside `useEffect`
  as `set-state-in-effect`. The accepted pattern is
  `void (async () => { await load(); })()`.
- In Vitest, never reuse one `Response` across two mocked `fetch` calls, pass
  string bodies rather than jsdom `Blob`s into Node's `Response`, and create
  fake timers with `{ shouldAdvanceTime: true }` when a fetch is pending.

## Workflow

- Trunk-based. Branch off `main` as `feat/*`, `fix/*`, `chore/*`, `docs/*`,
  `test/*`. One concern per branch. Details in `CONTRIBUTING.md`.
- Before opening a PR run, in `app/Backend`: `npm run lint:check`,
  `npm run typecheck`, `npm run build`, `npm test`; in `app/web`:
  `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`. CI runs the
  same plus both e2e suites.
- PRs are opened on GitHub (there is no `gh` CLI on the owner's machine) from
  `https://github.com/Kamel-27/travel-platform/compare/main...<branch>?expand=1`
  and merged with a merge commit.
- Merging to `main` deploys: the backend workflow rebuilds the containers on
  the VM when anything under `app/Backend` changes, and Vercel redeploys the
  web app. `/health` returns 502 for about twenty seconds while the new
  container boots and runs migrations, then 200 with `database` and `redis`
  both `up`.
- Mermaid in docs: validate changed diagrams with
  `npx -y @mermaid-js/mermaid-cli` before committing. A `;` inside a
  sequence-diagram message breaks the parser.
- Never commit `.env` files. Secrets live on the VM
  (`~/travel-platform/app/Backend/.env`) and in Vercel.

## Reviewing a change

Spec fidelity beats taste. Check a change against the docs above, then
against the invariants in this file. For anything touching `bookings`,
`payments`, `ledger` or `duffel`, ask: can this path run twice, can it run
late, can it run while another path for the same booking is running, and what
does the customer see in each case. Findings go in the PR, with file and line.
