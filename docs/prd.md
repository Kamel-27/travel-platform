# TravelHub — Product Requirements Document (PRD)

**Status:** Draft v2 (post product review — aligned with decided architecture: flights-only Phase 1, passwordless auth, Stripe test mode; added success metrics, refund policy, post-booking events, ticket delivery, localization stance)
**Date:** 2026-07-03
**Owner:** Kamel-27

---

## 1. Vision

TravelHub is a travel booking platform serving two customer types on one system:

1. **Direct consumers** who search and book for themselves (B2C, self-service).
2. **Travel Companies** (agencies) whose **Travel Agents** search and book on behalf of their own clients, under a company account that a **Travel Company Admin** manages — with a **Technical Admin** overseeing the whole platform.

Flight inventory/pricing is sourced from the Duffel API (see [duffel_api_integration_guide.md](duffel_api_integration_guide.md)); TravelHub's own value is the booking experience, the multi-tenant agency layer, payments/wallet handling, and platform administration on top of that supply.

**Flights ship first.** Hotels (Duffel Stays) are on the roadmap but are not part of the platform's day-one definition — see Phasing.

---

## 2. Roles

| Role | Scope | Introduced |
|---|---|---|
| **Technical Admin** | Platform-wide. Supervises all users, companies, bookings, system configuration, markup/commission rules, supplier integration health. | MVP (Phase 1) |
| **Normal User** | Self-service. Searches and books flights for themselves, pays directly. | MVP (Phase 1) |
| **Travel Company Admin** | Scoped to one Travel Company. Manages that company's agents, wallet/credit, and views the company's bookings. | Phase 2 |
| **Travel Agent** | Scoped to exactly **one** Travel Company (no multi-company membership). Searches and books on behalf of clients, using either the company wallet or the client's own payment method per booking. | Phase 2 |

A Travel Agent belongs to exactly one Travel Company — no cross-company affiliation.

Role-based access control ships per phase: two roles (`technical_admin`, `user`) in Phase 1; the two company roles are added in Phase 2.

---

## 3. Phasing

### Phase 1 (MVP) — Direct flight booking + platform admin
Ship the self-service consumer path end to end, **flights only**, plus the minimum admin surface needed to run it. No hotels, no Travel Company/Agent layer.

- Passwordless auth (Google OAuth + email magic link) for Normal Users — see §5.1
- Flight search & booking (Duffel Flights)
- Checkout: Stripe (test mode) with offer-expiry countdown
- Ticket/itinerary document generation & delivery (§5.6) — a distinct deliverable, not folded into the confirmation email
- User dashboard: booking history, booking detail, cancellation/refund flow
- Post-booking supplier events: airline schedule changes and cancellations surfaced to the user (§5.5)
- Technical Admin: user list, all-bookings view, supplier (Duffel) health/status, global markup configuration
- Notifications: booking confirmation, ticket delivery, schedule change, refund status (email channel)

### Phase 2 — B2B agency layer
- Travel Company onboarding & Travel Company Admin role
- Travel Agent accounts scoped to one company
- Company wallet/credit line (prepaid balance agents can book against)
- Per-booking billing choice: charge to company wallet **or** pass payment to the end client
- Company-level commission terms + subscription billing (mechanics in §5.9)
- Travel Company Admin views: agent activity, company bookings, wallet balance/statements
- Technical Admin: company management, subscription billing oversight, per-company commission rules
- Arabic UI / RTL support (decision on record now — see §7 Localization)

### Later / Not yet scoped
- Hotel search & booking (Duffel Stays) — moved out of MVP; the quote-then-book flow and Accommodation/Room/Rate model are documented in the integration guide for when this is picked up
- Loyalty/rewards for Normal Users
- Car rentals (Duffel Cars)
- Mobile app

---

## 4. Monetization

Two revenue mechanisms, both in scope:

1. **Commission/markup on bookings** — a margin added on top of the Duffel supplier price on every booking, regardless of whether it's booked by a Normal User or a Travel Agent.
2. **Subscription (Phase 2, Travel Companies only)** — a recurring platform-access fee charged to each Travel Company, independent of booking volume. Billing mechanics in §5.9.

Markup and subscription rates must be configurable by the Technical Admin, not hardcoded — this is a functional requirement, since different companies may negotiate different commission terms.

**Material constraint, stated plainly:** Phase 1 runs on Stripe **test mode** because a Stripe live merchant account cannot be opened in the founder's country. Phase 1 therefore cannot collect real money; revenue mechanisms are implemented and measurable but not live until a local gateway (Paymob for Egypt, Moyasar for Saudi Arabia — both planned) is integrated. This is a portfolio/validation constraint, not an oversight.

---

## 5. Functional Requirements

### 5.1 Authentication & Accounts (Phase 1, extended Phase 2)
- **Passwordless only**: Google OAuth and email magic link. No passwords exist anywhere in the system — consequently there is no "forgot password" flow to build.
- A Google login and a magic-link login with the same email resolve to the **same account** (email is the identity key) — this is intended behavior, not a collision.
- Magic links are single-use and short-lived (~15 min); the signin UI must handle the expired/used-link case with a clear "request a new link" path.
- Phase 2: Travel Company Admin creates Travel Agent accounts under their company (agents don't self-register); agent invitations use the same passwordless mechanisms.
- Role-based access control per the phase-tagged role table in §2.

### 5.2 Flight Search & Booking (Phase 1)
- Search by origin, destination, dates, passenger count, cabin class.
- Display offers with price (markup included), airline, duration, stops, baggage.
- Select an offer, enter passenger details, proceed to checkout. Passenger data collected must satisfy Duffel's order-creation requirements per passenger: given/family name, title, gender, date of birth, email, phone number — plus passport/ID fields when the offer requires identity documents.
- Respect Duffel's offer expiry — **the offer's own `expires_at` is authoritative and varies per offer/airline** (LCC offers can expire in minutes; there is no fixed 30-minute guarantee). The checkout countdown timer is driven by `expires_at`, and the offer is re-fetched at selection to revalidate price/availability before payment.
- If the offer expires mid-checkout, the user is told immediately and routed back to a fresh search — never allowed to pay against a dead offer.
- Booking confirmation with airline booking reference (PNR) shown to the user.

### 5.3 Checkout & Payments (Phase 1)
- **Provider: Stripe, test mode** (see §4 constraint). "Multi-method" means payment methods within Stripe (card, wallets) — not multiple gateways. Paymob/Moyasar are additive later via the payment-adapter design already in the ERD.
- Countdown timer tied to the offer's `expires_at`, not an arbitrary UI timer.
- Payment failure handling: user can retry without losing their selected offer if it hasn't expired.
- Payment success and supplier order creation are decoupled states: if money is captured but the airline order fails (offer expired at the last moment, supplier error), the system automatically initiates a full refund and tells the user — this "paid but not booked" state is explicit in the booking state machine, never silent.

### 5.4 User Dashboard (Phase 1)
- List of past/upcoming flight bookings.
- Booking detail view: status, PNR, passenger info, price paid, ticket document download (§5.6), and any schedule changes (§5.5).
- **Cancellation & refund flow** (policy, not just a button):
  - The user initiates cancellation from the booking detail view.
  - The fare's refund conditions (captured in the offer snapshot at booking time) are shown **before** the user confirms — including any airline penalty.
  - **Approval:** auto-approved when the supplier's conditions permit refund; otherwise routed to Technical Admin for manual handling.
  - **Refund amount policy:** the customer receives the supplier's refund **plus the full TravelHub markup** (the platform does not keep margin on a cancelled service); any airline penalty is borne by the customer and disclosed before confirmation.
  - Every refund records who initiated it, who approved it, the reason, and the amounts (customer refund vs. supplier refund) — required for support and reconciliation.

### 5.5 Post-Booking Supplier Events (Phase 1)
Airlines change schedules and cancel flights after ticketing; Duffel delivers these as webhooks (`order.airline_initiated_change_detected`). Requirements:
- Ingest and store every supplier event (dedup against at-least-once delivery).
- On a schedule change or airline cancellation: update the stored itinerary, visibly flag the affected booking in the dashboard, and notify the user by email.
- Phase 1 scope is **notify + display** — accept/rebook/refund handling of a change can be manual via Technical Admin; it does not need self-service resolution yet.
- A booking whose stored itinerary is stale relative to a received supplier event is a defect: support must never quote outdated times from our own DB.

### 5.6 Ticketing & Documents (Phase 1)
Duffel returns ticket numbers only — **no PDF, no downloadable file**. Generating the customer-facing document is TravelHub's job and its own deliverable:
- After ticketing, generate an itinerary/receipt document containing passenger names, full itinerary, e-ticket number(s) per passenger, and amounts paid.
- Deliverable in two channels: attached to the confirmation email and downloadable from the booking detail page.
- Documents must be regenerable from stored data (the booking snapshot), not one-shot artifacts.

### 5.7 Notifications (Phase 1: email)
- Booking confirmation (with PNR + ticket document per §5.6)
- Schedule change / airline cancellation (per §5.5)
- Refund initiated / completed (per §5.4)
- Magic-link sign-in emails (§5.1)
- Channels beyond email (SMS/WhatsApp — high-relevance for the target market) remain an open question (§9), deferrable past Phase 1.

### 5.8 Technical Admin (Phase 1, expanded Phase 2)
- View/manage all users and all bookings platform-wide.
- Configure global markup rules (Phase 1: one global rate; Phase 2: per-company override). Markup semantics: percentage of supplier base price, applied once per booking.
- Manually process cancellations/refunds that fall outside auto-approval (§5.4).
- Monitor Duffel API integration health (auth status, recent errors, rate-limit headroom, webhook processing lag).
- Phase 2: manage Travel Companies (create/suspend), view subscription status, set per-company commission terms.

### 5.9 Travel Company Admin + Subscription Billing (Phase 2)
- Manage Travel Agents under their company (create/deactivate).
- View/top-up company wallet balance and statements.
- View all bookings made by their agents (PII visibility policy is an open question — §9).
- View their company's subscription and commission terms (read-only — set by Technical Admin).
- **Subscription billing mechanics** (the machinery behind "subscription revenue"): per-company plan and price set by Technical Admin; recurring billing cycle (monthly default); payment collection method decided with the wallet design; failed-payment dunning with a defined grace period; continued non-payment triggers company suspension (semantics in §9 open questions — must be resolved before this ships).

### 5.10 Travel Agent (Phase 2)
- Search and book flights on behalf of a named client (not themselves). (Hotels: when Stays ships — see Later.)
- Choose billing method per booking: company wallet or client's own payment.
- View bookings they've personally made.

---

## 6. Success Metrics

How we know Phase 1 works — every metric below is computable from the data model as built (bookings, payment attempts, webhook events, refunds):

| Metric | Definition | Signal |
|---|---|---|
| Search→book conversion | Searches → offer selected → paid, as a funnel | Core product health |
| Payment success rate | Succeeded payments / payment attempts | Checkout + gateway integration quality |
| Offer-expiry abandonment | Checkouts lost to `expires_at` before payment | Is the checkout flow fast enough for real offer lifetimes? |
| Booking→ticket latency | Payment success → ticket document delivered | The §5.6 pipeline works |
| Webhook processing lag | Supplier/payment event received → processed | Operational health; feeds the admin dashboard |
| Cancellation/refund rate | Refunds / confirmed bookings, with reasons | Product & supply quality |
| Stale-itinerary incidents | Supplier events received but not reflected in a booking | Must be zero (§5.5) |

Phase 2 adds: active companies, bookings per agent, wallet vs. client-billing split per booking, subscription retention/churn.

---

## 7. Localization & Target Market

Explicit stance (previously a silent gap):

- **Target markets include Egypt and Saudi Arabia** — this is why Paymob and Moyasar are the planned live payment gateways.
- **Phase 1 UI is English-only.** **Arabic + RTL is a committed Phase 2 item**, decided now because RTL retrofits are expensive — Phase 1 frontend work must avoid hard-coded directionality where cheap to do so.
- **Currency:** Phase 1 displays and charges in the offer's currency as quoted (single-currency per booking). The moment Paymob (EGP) or Moyasar (SAR) goes live, a display/settlement currency policy is forced — the ERD already reserves an fx model for this. This is tracked as an open question (§9), *not* silently deferred under "multi-currency someday."

---

## 8. Non-Functional Requirements (summary — detailed in a separate NFR doc)

- Every booking-affecting action (offer selection, payment, cancellation, refund) must be traceable to a specific user/agent for support and audit purposes.
- Payment handling must minimize PCI scope (defer card data handling to the payment provider; never store raw card data).
- Admin actions (markup changes, refund approvals, company suspension, wallet adjustments) must be auditable — who changed what, when.
- Platform must degrade gracefully if Duffel is slow/unavailable (clear error, not silent failure), given Duffel's rate limits (120 req/60s on search in live mode; limits vary per endpoint) and per-offer expiry windows.
- Supplier and payment webhooks are at-least-once and unordered — ingestion must be idempotent.

---

## 9. Open Questions

**Blocking for Phase 1 — resolved, recorded here:**
- ~~Which payment gateway?~~ **Decided: Stripe test mode for Phase 1** (live payments impossible in founder's country); Paymob (Egypt) and Moyasar (Saudi Arabia) planned as the live gateways. §4/§5.3.
- ~~Refund amount policy~~ **Decided in §5.4**: supplier refund + full markup returned; airline penalty borne by customer, disclosed pre-confirmation.

**Open — must be answered before the relevant Phase 2 work starts:**
- **Company suspension semantics**: when a Travel Company is suspended (by admin action or subscription non-payment) — do agents lose login or only booking rights? Who services the company's in-flight bookings (a traveler mid-trip still needs cancellations/changes processed)? Is the wallet balance frozen, refunded, or drawn down? Blocking for wallet + subscription design.
- **Client PII visibility**: does a Travel Company Admin see their agents' clients' full passenger PII (passport numbers, contact details) or aggregate booking data only? Privacy-weighted; blocking for the Phase 2 permission model.
- **Wallet top-up mechanism**: manual admin credit vs. self-service top-up via payment gateway.
- **Display/settlement currency policy** once Paymob/Moyasar go live (EGP/SAR customer pricing vs. Duffel's quote currency) — see §7.

**Open — deferrable:**
- Notification channels beyond email (SMS/WhatsApp are common for Middle East travel bookings).

---

## 10. Out of Scope (for now)

- Hotels (moved to Later — see §3), car rentals, loyalty/rewards programs, mobile apps.
- Any second flight supplier beyond Duffel — single-supplier for the planning horizon of this PRD.

---

## 11. Downstream Documents

This PRD is the input for:
- **[ERD](erd.md)** — built and reviewed (Draft v2); covers User/AuthIdentity/MagicLinkToken, Booking/FlightOfferSnapshot/Slice/Segment/Passenger, Payment/PaymentAttempt/Refund, PaymentWebhookEvent/SupplierWebhookEvent, Document, and audit entities. The ERD is the authority on data-shape details.
- **System Design Doc** — module boundaries per §5, queue/Redis architecture per the [Duffel integration guide](duffel_api_integration_guide.md).
- **Booking/Order State Machine** — driven by §5.2/5.3/5.4/5.5, including the explicit "paid but order failed" state.
- **API Contract** — one endpoint group per functional area above.
