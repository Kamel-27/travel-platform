# PKFare Integration — Documentation Set

This directory is the single source of truth for adding **PKFare** as TravelHub's flight
supplier **alongside** the current **Duffel** integration. The goal is a clean **cutover**:
Duffel stays live while you test, PKFare ships dormant, and production flips to PKFare by
changing **one environment variable** — without touching critical booking, payment, ledger,
or refund logic.

Everything here about PKFare's API is **verified against the official PKFARE Flight Buyer API
docs** (`https://apifox.pkfare.com/apidoc/project-345083`, read July 2026), not guessed. Where
something could not be confirmed from the public docs it is explicitly flagged
`TODO(pkfare-verify)`.

> ⚠️ This supersedes the old, pre-credentials `docs/pkfare_integration_guide.md` (deleted in
> commit `1a272af`) and the deleted `app/api/src/pkfare/*` draft code, both of which had the
> **wrong auth** (extra timestamp in the sign) and **wrong transport** (base64 envelope +
> mandatory gzip). See [api-reference.md](./api-reference.md) for the corrected facts.

## Contents

| File | What it covers |
|---|---|
| [implementer-handover.md](./implementer-handover.md) | **Read first if you're implementing** — domain model, house conventions, the common-mistakes checklist, verification & PR gate |
| [api-reference.md](./api-reference.md) | Verified API architecture: auth, transport, endpoints, data models, order-status enum, ticketing webhook |
| [api-contracts.md](./api-contracts.md) | **Full per-endpoint request/response contracts** with real JSON examples and error codes — self-contained, no portal access needed |
| [architecture.md](./architecture.md) | **System architecture**: ports & adapters design, TypeScript interfaces/DTOs, sequence diagrams, error taxonomy, state-machine mapping |
| [integration-guide.md](./integration-guide.md) | Step-by-step integration into the NestJS backend (phased, Duffel-safe) |
| [duffel-coupling-and-gaps.md](./duffel-coupling-and-gaps.md) | Where the code is hard-wired to Duffel today, and what PKFare does **not** offer that we must resolve |
| [switch-runbook.md](./switch-runbook.md) | Production cutover, disabling Duffel, and rollback |

> 🛠️ **Implementing offline / with a smaller model?** Start with
> [implementer-handover.md](./implementer-handover.md) (conventions + pitfalls), then
> [architecture.md](./architecture.md) for the design and [api-contracts.md](./api-contracts.md)
> for the exact wire formats — together they contain everything needed without opening PKFare's
> portal.

---

## What PKFare is and what it offers

PKFare is a **B2B travel wholesaler / aggregator** (a "consolidator"), not a merchant-of-record
API like Duffel. You are an authenticated **buyer partner** drawing on a **prepaid wallet**:
PKFare deducts each ticket's cost from your balance at ticketing time (payment gateway
`PREPAY`), and you separately charge your own customer (via Paymob, unchanged).

**Content & capabilities (per PKFare's product pages and Buyer API):**

- **Flights** — live inventory across **600+ airlines** (full-service + LCC), one-way / round-trip
  / open-jaw (max 2 journeys per search). Fares come as **`PUBLISHED`** and **`PRIVATE`**
  (negotiated/wholesale) types, with per-passenger-type fare + tax breakdowns.
- **Fare rules & baggage** — structured `miniRuleMap` (refund/change penalties with time tiers)
  and `baggageMap` returned inline on search.
- **Ancillaries & branded fares** — separate Ancillary booking APIs; branded-fare integration
  guide exists.
- **Full booking lifecycle** — search → precise pricing → book (PNR) → pay (wallet) → ticketing
  → order detail, all automated.
- **Post-ticketing automation** — **push webhook** (`TicketIssuanceNotify_V2`) for issued/rejected
  tickets + PNR + ticket numbers, plus **Refund**, **Change**, **Void**, and **Flight schedule
  change** API families.
- **Hotels** — PKFare also aggregates 400k+ properties (out of scope for this flight integration).

### Capability comparison: PKFare vs Duffel (as used by TravelHub)

| Capability | Duffel (today) | PKFare | Impact on TravelHub |
|---|---|---|---|
| Search | `POST /air/offer_requests` → offers | `POST /json/shoppingV9` → `solutions/flights/segments` | Different mapper; same `NormalizedOffer` output |
| Re-price / revalidate | `GET /air/offers/:id` (`expires_at`) | `POST /json/precisePricing_V11` (re-price `solutionId`) | **No offer `expires_at`** — cache/TTL strategy changes (see gaps) |
| Book + pay | **One** atomic `POST /air/orders` (instant payment) | **Split**: `preciseBooking` → `ticketing` (wallet) | Confirmation becomes **async** (see gaps) |
| Merchant / settlement | Merchant-of-record or pass-through | **Prepaid wallet** (`PREPAY`) | New failure mode: insufficient balance |
| E-ticket documents | Returned sync in order + `order.created` webhook | **Async**: `TicketIssuanceNotify_V2` push + `orderDetail` poll | Reuse existing "confirm later" sweep + webhook table |
| Post-booking sync | Webhooks (`order.created`, schedule change) | `TicketIssuanceNotify_V2` push + Schedule-change APIs; `orderDetail` poll backstop | Both suppliers fit the `SupplierWebhookEvent` pattern |
| Cancel | 2-step quote + confirm (**sync** refund amount) | `cancel` (pre-ticket) / Refund APIs (**async**, `UNDER_REVIEW→REFD_REIMED`) | Refund/ledger must tolerate a pending reimbursement window |
| Airport autocomplete | `GET /places/suggestions` | **None found** in Buyer API | Keep a local IATA list for `/flights/airports/search` |
| Auth | `Authorization: Bearer` + `Duffel-Version` | `sign = MD5(partnerId+partnerKey)` (static) in body | Adapter-local concern |
| Amounts | major-unit decimal strings | per-pax decimal fare+tax in solution `currency` | Adapter converts to minor units |

The bottom line: **the normalization layer and booking state machine already in place absorb
most of the difference.** The real work is (1) a provider abstraction so nothing outside one
module knows which supplier is active, and (2) handling the handful of genuine semantic gaps
in [duffel-coupling-and-gaps.md](./duffel-coupling-and-gaps.md).

## Source

- PKFARE Flight Buyer API — <https://apifox.pkfare.com/apidoc/project-345083>
- PKFARE product overview — <https://www.pkfare.com/flight>
