# TravelHub — Product Requirements Document (PRD)

**Status:** Draft v1
**Date:** 2026-07-03
**Owner:** Kamel-27

---

## 1. Vision

TravelHub is a flight & hotel booking platform serving two customer types on one system:

1. **Direct consumers** who search and book for themselves (B2C, self-service).
2. **Travel Companies** (agencies) whose **Travel Agents** search and book on behalf of their own clients, under a company account that a **Travel Company Admin** manages — with a **Technical Admin** overseeing the whole platform.

Flight and hotel inventory/pricing is sourced from the Duffel API (see [duffel_api_integration_guide.md](duffel_api_integration_guide.md)); TravelHub's own value is the booking experience, the multi-tenant agency layer, payments/wallet handling, and platform administration on top of that supply.

---

## 2. Roles

| Role | Scope | Introduced |
|---|---|---|
| **Technical Admin** | Platform-wide. Supervises all users, companies, bookings, system configuration, markup/commission rules, supplier integration health. | MVP (Phase 1) |
| **Normal User** | Self-service. Searches and books flights/hotels for themselves, pays directly. | MVP (Phase 1) |
| **Travel Company Admin** | Scoped to one Travel Company. Manages that company's agents, wallet/credit, commission terms, and views the company's bookings. | Phase 2 |
| **Travel Agent** | Scoped to exactly **one** Travel Company (no multi-company membership). Searches and books on behalf of clients, using either the company wallet or the client's own payment method per booking. | Phase 2 |

A Travel Agent belongs to exactly one Travel Company — no cross-company affiliation.

---

## 3. Phasing

### Phase 1 (MVP) — Direct booking + platform admin
Ship the self-service consumer path end to end, plus the minimum admin surface needed to run it. No Travel Company/Agent layer yet.

- Auth (signup/signin) for Normal Users
- Flight search & booking (Duffel Flights)
- Hotel search & booking (Duffel Stays)
- Checkout: multi-method payment with offer-expiry countdown (already scaffolded in frontend)
- User dashboard: booking history, booking detail, cancellation status
- Technical Admin: user list, all-bookings view, supplier (Duffel) health/status, global markup configuration
- Booking confirmation notifications (email at minimum)

### Phase 2 — B2B agency layer
- Travel Company onboarding & Travel Company Admin role
- Travel Agent accounts scoped to one company
- Company wallet/credit line (prepaid balance agents can book against)
- Per-booking billing choice: charge to company wallet **or** pass payment to the end client
- Company-level commission/subscription terms configuration
- Travel Company Admin views: agent activity, company bookings, wallet balance/statements
- Technical Admin: company management, subscription billing oversight, per-company commission rules

### Later / Not yet scoped
- Loyalty/rewards for Normal Users
- Multi-currency / multi-region pricing rules
- Car rentals (Duffel Cars)
- Mobile app

---

## 4. Monetization

Two revenue mechanisms, both in scope, applied per Travel Company (and implicitly to direct users via markup only):

1. **Commission/markup on bookings** — a margin added on top of the Duffel supplier price on every booking, regardless of whether it's booked by a Normal User or a Travel Agent.
2. **Subscription (Phase 2, Travel Companies only)** — a recurring platform-access fee charged to each Travel Company, independent of booking volume.

Markup and subscription rates must be configurable by the Technical Admin, not hardcoded — this is a functional requirement, not just a business note, since different companies may negotiate different commission terms.

---

## 5. Functional Requirements

### 5.1 Authentication & Accounts (Phase 1, extended Phase 2)
- Email/password signup and signin for Normal Users (already scaffolded in frontend: `signin`/`signup` pages).
- Phase 2: Travel Company Admin creates Travel Agent accounts under their company (agents don't self-register).
- Role-based access control across all four roles.
- Session/auth mechanism to be defined in the System Design doc (not a product-layer decision).

### 5.2 Flight Search & Booking (Phase 1)
- Search by origin, destination, dates, passenger count, cabin class (matches existing mock data shape in `app/web`).
- Display offers with price, airline, duration, stops, baggage.
- Select an offer, enter passenger details, proceed to checkout.
- Respect Duffel's offer expiry (~30 min) — surfaced to the user via the existing countdown-timer checkout UI.
- Booking confirmation with airline booking reference (PNR) shown to the user.

### 5.3 Hotel Search & Booking (Phase 1)
- Search by location, check-in/check-out dates, guest/room count.
- Display accommodation, room, and rate options (price, cancellation policy, board type).
- Quote-then-book flow per Duffel Stays (protects against stale pricing).
- Booking confirmation with property details and cancellation terms shown to the user.

### 5.4 Checkout & Payments (Phase 1)
- Multi-method payment support (already scaffolded).
- Countdown timer tied to offer/quote expiry, not an arbitrary UI timer.
- Payment failure handling: user must be able to retry without losing their selected offer if it hasn't expired.
- Phase 2 addition: at checkout, a Travel Agent chooses whether to charge the company wallet or the client's payment method.

### 5.5 User Dashboard (Phase 1)
- List of past/upcoming bookings (flights + hotels).
- Booking detail view (status, reference, passenger/guest info, price paid).
- Cancellation request flow (subject to the supplier's conditions surfaced at booking time).

### 5.6 Technical Admin (Phase 1, expanded Phase 2)
- View/manage all users and all bookings platform-wide.
- Configure global markup rules (Phase 1: one global rate; Phase 2: per-company override).
- Monitor Duffel API integration health (auth status, recent errors, rate-limit headroom).
- Phase 2: manage Travel Companies (create/suspend), view subscription status, set per-company commission terms.

### 5.7 Travel Company Admin (Phase 2)
- Manage Travel Agents under their company (create/deactivate).
- View/top-up company wallet balance and statements.
- View all bookings made by their agents.
- View their company's subscription and commission terms (read-only — set by Technical Admin).

### 5.8 Travel Agent (Phase 2)
- Search and book flights/hotels on behalf of a named client (not themselves).
- Choose billing method per booking: company wallet or client's own payment.
- View bookings they've personally made.

---

## 6. Non-Functional Requirements (summary — detailed in a separate NFR doc)

- Every booking-affecting action (search offer selection, payment, cancellation) must be traceable to a specific user/agent for support and audit purposes.
- Payment handling must minimize PCI scope (defer card data handling to the payment provider, not store raw card data).
- Admin actions (markup changes, company suspension, wallet adjustments) must be auditable — who changed what, when.
- Platform must degrade gracefully if Duffel is slow/unavailable (surface a clear error, not a silent failure), given Duffel's own 120 req/60s rate limit and offer expiry windows.

---

## 7. Out of Scope (for now)

- Car rentals, loyalty/rewards programs, multi-currency pricing, mobile apps — explicitly deferred, not part of Phase 1 or Phase 2 planning.
- Any second flight/hotel supplier beyond Duffel — single-supplier for the planning horizon of this PRD.

---

## 8. Open Questions

- Which payment gateway/processor sits behind "multi-method payment support"? Not yet chosen — needed before the Payments section of the System Design doc can be finalized.
- Wallet top-up mechanism for Travel Companies (manual admin credit vs self-service top-up via payment gateway) — affects Phase 2 scope.
- Notification channels beyond email (SMS/WhatsApp are common for Middle East travel bookings, given RUH/DXB present in existing mock data) — not yet decided.

---

## 9. Downstream Documents

This PRD is the input for:
- **ERD** — entities implied here: User, TravelCompany, TravelAgent (or a `role` on User + `company_id`), Booking/Order, Passenger, Payment, Wallet, WalletTransaction, MarkupRule/CommissionRule.
- **System Design Doc** — module boundaries per section 5, auth/session strategy, wallet transaction integrity.
- **Booking/Order State Machine** — driven by sections 5.2/5.3/5.4.
- **API Contract** — one endpoint group per functional area above.
