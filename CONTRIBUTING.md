# Contributing — TravelHub

**Status:** Verified against repo 2026-10-27 (main @ b176f47)

Trunk-based workflow: `main` is always deployable, all work happens on
short-lived branches merged via PR. No long-lived `develop`/`release` branches.
A merge to `main` that touches `app/Backend/**` deploys the backend to the
production VM automatically, and Vercel rebuilds the frontend on every merge —
see `docs/deployment.md`. Treat every PR as a production change.

---

## 1. Branch naming

```
<type>/<short-kebab-description>
```

| Type | Use for |
|---|---|
| `feat/` | New feature or capability |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring, no behavior change |
| `chore/` | Tooling, deps, config, CI |
| `test/` | Adding/fixing tests only |

Examples from the history: `feat/real-email`, `fix/booking-money-safety`,
`chore/production-hardening`, `test/web-suite`, `docs/project-readme`.

Scope the branch to one thing. If you catch yourself writing "and" in the
branch name, it is probably two PRs.

---

## 2. Commit messages — Conventional Commits

```
<type>(<scope>): <short summary, imperative mood>

<optional body: why, not what>

<optional footer: Closes #12, BREAKING CHANGE: ...>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`, `style`

**Scope** = the part of the repo touched: `web`, `backend`, `admin`, `ci`,
`docs`, or a feature area (`flights`, `auth`, `payments`, `checkout`).
Multiple scopes are comma-separated: `feat(web,ci): …`.

Examples from the history:
```
feat(backend): real email transport via Resend (magic link + booking confirmation)

fix(backend): make every exit from paid apply exactly once, and refund for real

test(web,ci): playwright smoke run and both suites in CI

docs: booking flow v2 plan (pricing, hold & retry, checkout, ledger)
```

Rules:
- Imperative mood ("add", not "added"/"adds").
- One logical change per commit — do not bundle an unrelated fix into a
  feature commit.
- Summary line ≤ 72 chars; use the body for the *why* if it is not obvious.
- Never commit directly to `main`.

---

## 3. Day-to-day flow

1. `git checkout main && git pull` — start from an up-to-date `main`.
2. `git checkout -b feat/<thing>` — branch per unit of work.
3. Commit incrementally as you go (conventional commits, above).
4. Run the pre-PR checks (§6).
5. `git push -u origin feat/<thing>` and open a PR into `main` (§4).
6. Address review feedback with new commits on the same branch — do not
   force-push over review history unless cleaning up right before merge.
7. Merge with a **merge commit** (GitHub's default "Create a merge commit"),
   then delete the branch.

### How merges actually land

Every merged PR so far (#2–#43; #1 never landed) has a merge commit: `main` history
reads `Merge pull request #N from Kamel-27/<branch>` followed by the branch's
individual commits. There is no squashing, so **each commit on your branch
ends up on `main` as-is** — keep them clean and conventional, because they
are the history, not a draft that gets collapsed later.

---

## 4. Pull requests

**Title** = same format as a commit message: `feat(flights): add offer search
endpoint`. GitHub puts it in the merge commit's body.

**Description template:**
```markdown
## Summary
- What changed and why (1-3 bullets)

## Test plan
- [ ] How you verified it works
```

Checklist before you ask for review (or self-review, if solo):
- [ ] One feature/fix/doc set per PR, not a grab-bag.
- [ ] CI is green on all four jobs (§5).
- [ ] No stray debug code, commented-out blocks or unrelated file changes.
- [ ] If the change touches the API, the data model, the booking state machine
      or the deploy setup, the matching doc in `docs/` is updated **in the
      same PR** (§7).
- [ ] If the change adds an env var, `app/Backend/.env.example` or
      `app/web/.env.example` is updated, and `docs/deployment.md` §3 if it is
      needed in production.
- [ ] Use a **draft PR** for work-in-progress you want visible but not ready.

---

## 5. CI — `.github/workflows/ci.yml`

Runs on every PR targeting `main` and on every push to `main`. Four
independent jobs, all on Node 22:

| Job | Where | What it runs | Gate |
|---|---|---|---|
| `web` | `app/web` | `npm run lint`, `typecheck`, `build`, `test:cov` (Vitest + Testing Library, jsdom) | Coverage thresholds in `vitest.config.mts`: **90% statements / 85% branches / 90% functions / 90% lines**, scoped to `src/lib/**` and `src/components/**` |
| `web-e2e` | `app/web` | `npx playwright install --with-deps chromium`, then `npm run test:e2e` against a production build. Every `/api/v1` call is intercepted in the specs, so no backend is started. On failure the Playwright report is uploaded as an artifact (7 days). | Pass/fail |
| `backend` | `app/Backend` | `npm run lint:check`, `typecheck`, `build`, `test:cov` (Jest; everything external is mocked) | Coverage thresholds in `package.json` → `jest.coverageThreshold.global`: **55% statements / 47% branches / 45% functions / 55% lines** |
| `backend-e2e` | `app/Backend` | Starts `postgres:16-alpine` and `redis:7-alpine` as job services, `npm run migration:run`, then `npm run test:e2e` | Pass/fail |

A coverage threshold failure fails the job, so an untested addition to a
covered area blocks the merge. The `backend` job's steps are the same ones the
deploy workflow repeats before it touches the VM.

> Note: whether GitHub branch protection on `main` currently *requires* these
> checks is a repository setting and cannot be read from the repo. Treat a
> red job as blocking regardless.

---

## 6. Run before opening a PR

These mirror CI exactly; if they pass locally the PR should be green.

**Web** (`app/web`):
```bash
npm run lint && npm run typecheck && npm run build && npm run test:cov
npm run test:e2e          # Playwright; builds and serves the app itself
```

**Backend** (`app/Backend`) — unit tests need nothing running:
```bash
npm run lint:check && npm run typecheck && npm run build && npm run test:cov
```

**Backend e2e** needs local Postgres + Redis from the repo-root compose file:
```bash
docker compose up -d                    # repo root: postgres:5432, redis:6379
cd app/Backend && npm run migration:run && npm run test:e2e
```

`npm run lint` in the backend auto-fixes; `lint:check` is the read-only
variant CI uses. Run `npm run format` if prettier complains.

---

## 7. Where docs live

- `docs/` holds the living documents. They describe the system as built;
  where one disagrees with the code, fix the doc.
  - `api_contract.md` — every endpoint and its contract. Changing a route,
    payload or error code updates it in the same PR.
  - `erd.md` / `erd.png` — the data model. A migration that adds or changes a
    table or column updates it in the same PR.
  - `booking_state_machine.md` — booking states and transitions. A new state
    or transition updates it in the same PR.
  - `auth_flow.md`, `sequence_diagrams.md`, `nfr.md`,
    `duffel_api_integration_guide.md` — behaviour references; update when the
    behaviour they describe changes.
  - `deployment.md` — the production runbook. Changes to
    `docker-compose.prod.yml`, the `Caddyfile`, the deploy workflow or a
    required env var update it in the same PR.
  - `booking_flow_v2_plan.md` — the one forward-looking doc; a plan, not a
    description.
- `docs/archive/` is history (`prd.md`, `roadmap.md`). Nothing there is
  maintained and nothing new goes there except a plan that has finished
  serving its purpose; see `docs/archive/README.md`.
- `README.md` at the root is the map of the project; `CONTRIBUTING.md` (this
  file) is the process.

---

## 8. `main` branch protection

Recommended settings (GitHub → Settings → Branches → rule for `main`):
require a PR before merging, require the four CI jobs to pass, require the
branch to be up to date, block force-pushes and deletion.

> Note: whether these are currently enabled is not visible from the repo.
