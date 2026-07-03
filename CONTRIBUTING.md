# Git Workflow — TravelHub

Trunk-based workflow: `main` is always deployable, all work happens on short-lived branches merged via PR. No long-lived `develop`/`release` branches — the project is early-stage and doesn't need that overhead yet.

---

## 1. Branch Naming

```
<type>/<short-kebab-description>
```

| Type | Use for |
|---|---|
| `feat/` | New feature or capability |
| `fix/` | Bug fix |
| `docs/` | Documentation only (PRD, ERD, guides, README) |
| `refactor/` | Code restructuring, no behavior change |
| `chore/` | Tooling, deps, config, CI |
| `test/` | Adding/fixing tests only |

Examples:
- `docs/prd-and-erd`
- `feat/flights-search-api`
- `fix/checkout-countdown-timer`
- `chore/backend-eslint-setup`

Scope the branch to one thing. If you catch yourself writing "and" in the branch name, it's probably two PRs.

---

## 2. Commit Messages — Conventional Commits

```
<type>(<scope>): <short summary, imperative mood>

<optional body: why, not what>

<optional footer: Closes #12, BREAKING CHANGE: ...>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`, `style`

**Scope** = the part of the repo touched (matches folder structure):
`web`, `backend`, `flights`, `hotels`, `auth`, `payments`, `docs`, `ci`

Examples:
```
feat(flights): add offer search endpoint

docs(erd): add booking and wallet entities

fix(checkout): stop countdown timer from resetting on re-render

chore(backend): add eslint + prettier config
```

Rules:
- Imperative mood ("add", not "added"/"adds").
- One logical change per commit — don't bundle an unrelated fix into a feature commit.
- Summary line ≤ 72 chars; use the body for the *why* if it's not obvious.
- Never commit directly to `main`.

---

## 3. Day-to-Day Flow

1. `git checkout main && git pull` — start from an up-to-date `main`.
2. `git checkout -b feat/flights-search-api` — branch per unit of work.
3. Commit incrementally as you go (conventional commits, above).
4. `git push -u origin feat/flights-search-api`.
5. Open a PR into `main` (template below).
6. Address review feedback with new commits on the same branch — don't force-push over review history unless asked to clean up before merge.
7. Merge via **squash merge** (keeps `main` history one commit per PR, readable). Delete the branch after merge.

---

## 4. Pull Requests

**Title** = same format as a commit message: `feat(flights): add offer search endpoint`. This becomes the squash-merge commit message on `main`, so make it count.

**Description template:**
```markdown
## Summary
- What changed and why (1-3 bullets)

## Test plan
- [ ] How you verified it works
```

Guidelines:
- Keep PRs small and reviewable — one feature/fix/doc set, not a grab-bag.
- Use **draft PRs** for work-in-progress you want visible but not ready for review.
- Link related issues (`Closes #12`) if/when issues are tracked.
- Don't merge your own PR without at least a self-review pass on the diff — check for stray debug code, commented-out blocks, unrelated file changes.

---

## 5. `main` Branch Protection (GitHub settings to enable)

Once you're ready to lock this in on GitHub (Settings → Branches → branch protection rule for `main`):
- Require a pull request before merging (no direct pushes, including from admins if working with others).
- Require status checks to pass before merging (once CI is set up — lint/build/test).
- Require branches to be up to date before merging.
- Disallow force-pushes and deletion of `main`.

I can apply these via `gh api` if you want — that changes shared repo settings, so I'll only do it on your explicit go-ahead.

---

## 6. Applying This to Your Current Working Tree

Right now `feat/project-setup` has mixed, uncommitted changes: legitimate deletions (`app/Booking-System`, the old `docs/*` files being replaced), a new `app/Backend` scaffold, and new docs (`prd.md`, `duffel_api_integration_guide.md`). Under this workflow that's really 2-3 separate PRs, not one:

- `chore/remove-broken-booking-system-gitlink` — the `app/Booking-System` deletion
- `feat/backend-nestjs-scaffold` — the new `app/Backend`
- `docs/prd-and-duffel-guide` — the new docs, paired with deleting the docs they replace

Say the word and I'll help split and commit these properly instead of one big mixed commit.
