# TravelHub — Roadmap & Delivery Plan

**Status:** Draft v1
**Date:** 2026-07-03

This is the document that answers "what do we build in what order, and when does process (tests/CI/CD) kick in." It doesn't repeat git mechanics — see [CONTRIBUTING.md](../CONTRIBUTING.md) for branch/commit/PR rules — it says *when* to apply them to what.

---

## 1. Documentation Inventory

| Doc | Status | Purpose | Depends on |
|---|---|---|---|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Done | Git branching/commit/PR workflow | — |
| [duffel_api_integration_guide.md](duffel_api_integration_guide.md) | Done, fact-checked against live Duffel docs (no supplier idempotency; real webhook event names; variable offer expiry) | Supplier capabilities, queue/Redis architecture | — |
| [prd.md](prd.md) | Done v2 (post-review: flights-only MVP, passwordless auth, refund policy, success metrics, localization stance) | Product scope, roles, monetization | — |
| [erd.md](erd.md) | Done v2.1 (post-review + Duffel fact-check corrections) | Data model | PRD |
| [booking_state_machine.md](booking_state_machine.md) | Done v1 | Exact status transition rules for `Booking`/`Payment`/`Refund` | ERD |
| [sequence_diagrams.md](sequence_diagrams.md) | Done v1 | Order-creation-with-idempotency, webhook race, refund flows | State machine |
| [api_contract.md](api_contract.md) | Done v1 | Request/response shapes per endpoint | State machine |
| [auth_flow.md](auth_flow.md) | Done v1 | Google OAuth + magic-link sequences, incl. the same-email race `AuthIdentity`'s constraints guard against | ERD |
| [nfr.md](nfr.md) | Done v1 | Session/token strategy, PCI scope, rate limiting | PRD + ERD |

Testing, CI, and deployment are covered in this roadmap rather than separate docs — split them out later only if they outgrow this.

---

## 2. Build Order (PRD phases → technical milestones)

| Milestone | Scope |
|---|---|
| **M0** (current) | Docs foundation: PRD, ERD, Duffel guide, this roadmap |
| **M1** | Backend foundations: DB (Postgres) + Redis wired into `app/Backend`, `User`/`AuthIdentity`/`MagicLinkToken` tables, Google OAuth + magic-link auth working end-to-end |
| **M2** | Flights module: `DuffelModule` adapter, search endpoint, `FlightOfferSnapshot`/`Slice`/`Segment` persistence, booking creation skeleton (Duffel order call stubbed/mocked) |
| **M3** | Payment module: Stripe integration, `Payment`/`PaymentAttempt`/`PaymentWebhookEvent`/`Refund`, idempotency key wired through |
| **M4** | Full booking state machine live end-to-end: search → passenger details → pay → Duffel order → `Document` generation |
| **M5** | Admin surface: `MarkupRule` management, `AuditLog`, all-bookings view for `technical_admin` |
| **M6** | Frontend wiring: replace `app/web`'s mock data with real calls per `api_contract.md` |
| **M7** | Hardening: refunds, cancellation, `SupplierWebhookEvent` (schedule changes) handling, NFR items |
| **M8** | First deploy to a live demo environment |

Each milestone is one or more `feat/*` branches per [CONTRIBUTING.md](../CONTRIBUTING.md) — don't treat a milestone as one giant branch.

---

## 3. Testing Strategy

| Layer | Tool | What it covers | When |
|---|---|---|---|
| Unit | Jest (already in the NestJS scaffold) | Markup calculation, idempotency key generation, state-transition logic | Written **with** the code, not after — especially M3/M4, where correctness is the entire point of the ERD's design (idempotency, dedup, the `paid`→`confirmed`/`order_failed` fork) |
| Integration | NestJS testing module + real test Postgres/Redis (docker-compose) | Repository/service layer, webhook reconciliation, payment↔booking consistency | From M3 onward |
| E2E/API | Supertest against a running app | Golden path (search→book→pay→confirm) **and** key failure paths: payment succeeds but Duffel order fails, duplicate webhook delivery, offer expires mid-checkout | From M4 onward |
| Frontend | React Testing Library, then Playwright | Component tests once wired to real API (M6); full booking-journey E2E once backend is live | From M6 onward |

Rule of thumb: the payment/state-machine code is where bugs are expensive and silent (double charges, lost bookings) — that's the code that earns tests written alongside it. Admin CRUD screens don't need the same rigor.

---

## 4. CI Strategy — when to introduce it

CI doesn't wait for "enough code to matter" — it should exist *before* the first real feature branch lands, because branch protection (per `CONTRIBUTING.md`) needs something to require.

| Stage | Trigger | What runs |
|---|---|---|
| **1 — now, before M1** | First real backend code | Lint + typecheck + build, both `app/web` and `app/Backend`, on every PR |
| **2 — ~M2/M3** | First unit/integration tests exist | Add a test job |
| **3 — ~M4** | E2E tests exist against a running app | Add an E2E job with Postgres+Redis as docker-compose services in CI |

Once Stage 1 exists, flip on the `main` branch protection rules already described in `CONTRIBUTING.md` §5 (require the check to pass, no direct pushes).

---

## 5. CD / Deployment Strategy — when and how

**Don't automate a deploy you haven't done manually.** Sequence:

1. Once M4 (the full booking flow) works locally end-to-end, do **one manual deploy** to a chosen host, using Duffel/Stripe test-mode keys. Confirm it actually works in that environment before automating anything.
2. Only after that manual deploy is proven, wire a CD workflow (GitHub Actions) that auto-deploys `main` on merge to the same target.

**Hosting recommendation** (optimized for a portfolio project — real infra, minimal ops overhead):
- **Frontend** (`app/web`, Next.js) → **Vercel**. Trivial GitHub integration, free tier.
- **Backend** (`app/Backend`, NestJS) + **Postgres** + **Redis** → **Railway** or **Render**. Both deploy from GitHub with minimal config and offer managed Postgres/Redis add-ons — still *your* database (not a third-party BaaS), which matters given the earlier "full control of the data" requirement.
- **Environments**: local (docker-compose for Postgres+Redis) plus **one** deployed demo environment. Full staging/production separation isn't worth the overhead for a portfolio project — this is a deliberate scope cut, not an oversight; revisit only if this goes into real production use.
- **Secrets**: the host's own env-var/secret manager, never committed. Test-mode Duffel/Stripe keys only, until there's an actual reason for live keys.

---

## 6. Immediate Next Actions

1. ~~Run the PRD and Duffel-guide review prompts~~ — done; findings applied (PRD v2, ERD v2.1, corrected guide).
2. ~~Draft the pending docs~~ — done; all five docs in §1 are at v1.
3. Stand up Stage-1 CI (lint/build) — cheap, no dependencies, can happen anytime. **← next**
4. Start M1 (backend foundations) per §2.
