# TravelHub: Duffel API Integration & Architecture Guide

Research reference for evaluating and integrating the **Duffel API** as the flights/hotels supplier for this platform. No code is implemented here — this is the planning document to align on before writing the `DuffelModule`.

> Context found in-repo: `app/Backend` is currently a bare NestJS scaffold (no routes, no DB, no queue/Redis deps). `app/web` (Next.js) already calls `GET /api/v1/flights` and `GET /api/v1/hotels`, which don't exist yet. `implementation_plan.md` previously proposed Amadeus; the prior `app/api` used PKFare. This doc treats Duffel as the candidate replacement supplier.

---

## 1. What Duffel Actually Is

Duffel is a merchant-of-record-capable **travel supply API** — one REST API in front of multiple content sources, instead of you integrating GDS/NDC/LCC connections yourself.

| Product | What it gives you |
|---|---|
| **Flights API** | Search + book flights across 300+ airlines, blending three content sources at once |
| **Stays API** | Search + book 2M+ hotel properties worldwide |
| **Seat Maps** | Real seat-map data per segment for seat selection UI |
| **Ancillaries** | Bags, seats, and other paid extras attachable to an order |
| **Payments** | Duffel can act as merchant of record, or you can pass your own card/payment method and add markup |
| **Links** | Duffel-hosted, white-label booking UI you can embed instead of building your own front end |
| **Cars** | Ground transport add-on to round out itineraries (newer, smaller footprint than flights/stays) |
| **Loyalty** | Attach loyalty programme numbers to bookings where the airline supports it |

**Content sources blended per flight search:**
- **NDC** (airline-direct) — richer fares, branded content, better ancillary access
- **GDS** — broad legacy global coverage
- **LCC** — low-cost carriers GDS often misses

This matters for the "how much data can I get" question below: field richness (branded fares, loyalty support, baggage detail) varies **by which content source produced the offer**, not just by the API version.

Sources: [Duffel Docs Overview](https://duffel.com/docs), [Getting Started with Flights](https://duffel.com/docs/guides/getting-started-with-flights), [Duffel Ancillaries](https://duffel.com/flights/ancillaries), [Duffel Stays](https://duffel.com/stays)

---

## 2. Flights: Data Model (Offer Request → Offer → Order)

### Flow
```
Offer Request (search criteria) → list of Offers → Get single Offer (adds services) → Create Order → manage Order
```

### Offer object — top-level fields
`id`, `created_at`, `updated_at`, `expires_at` (offers expire ~30 min after creation, exact deadline in this field), `live_mode`, `partial`, `base_amount`/`base_currency`, `tax_amount`/`tax_currency`, `total_amount`/`total_currency`, `total_emissions_kg` (CO₂ estimate), `owner` (airline info + logos), `supported_loyalty_programmes`, `supported_passenger_identity_document_types`, `passenger_identity_documents_required`, `payment_requirements` (`requires_instant_payment`, `payment_required_by`, `price_guarantee_expires_at`), `available_airline_credit_ids`, `private_fares` (corporate/negotiated fares).

### Nested: slices → segments
- **Slice** (one direction of travel): `origin`, `destination`, `duration`, `fare_brand_name`, `conditions` (refund/change policy for that slice), `segments[]`.
- **Segment** (one physical flight): `departing_at`, `arriving_at`, `origin`/`destination` + terminals, `aircraft`, `marketing_carrier`/`operating_carrier` (codeshare distinction), flight numbers, `stops[]`.

### Passengers, conditions, services
- `passengers[]`: type (adult/child/infant), name, age, `loyalty_programme_accounts`.
- `conditions`: `refund_before_departure` / `change_before_departure`, each with `allowed`, `penalty_amount`, `penalty_currency`.
- `available_services[]` (only on **Get single offer**, not list): baggage, seats, etc. — `total_amount`, `segment_ids`, `passenger_ids`, `maximum_quantity`.

### List Offers pagination/sorting
`offer_request_id` (required filter), `limit` (1–200, default 50), `after`/`before` cursors, `sort` = `total_amount` or `total_duration` (prefix `-` for descending), `max_connections`.

### Order object (post-booking)
`id`, `booking_reference` (airline PNR, ~6 chars), `booking_references[]` (all carrier references for multi-carrier itineraries), pricing fields (same shape as Offer), `passengers`, `slices`, `services`, `documents` (issued e-tickets), `type` (`instant` vs `hold`), `content` (`self-managed` vs `managed`), `payment_status`, `conditions`, `available_actions` (cancel/change/update), `changes`/`airline_initiated_changes`, `cancellation`/`cancelled_at`/`void_window_ends_at`, `metadata` (your own key-value pairs), `users`.

### Order endpoints
`POST` create order, `GET` single/list (with filters/sort), `PATCH` update, `POST` price order, `GET`/`POST` services, `POST` cancel, order change requests (separate resource: propose → accept a change).

**"Hold" orders** let you reserve a fare and pay later before a deadline — useful for agent-assisted or B2B flows where payment isn't instant.

Sources: [Offers API](https://duffel.com/docs/api/v2/offers), [Orders API](https://duffel.com/docs/api/orders), [Order Change Requests](https://duffel.com/docs/api/order-change-requests/get-order-change-request-by-id), [Displaying Offer/Order Conditions](https://duffel.com/docs/guides/displaying-offer-and-order-conditions), [Holding Orders Guide](https://www.postman.com/duffelhq/duffel/documentation/8djwi3u/duffel-api-holding-orders-and-paying-later-guide)

---

## 3. Stays (Hotels): Data Model

### Three-layer model
1. **Accommodation** — the physical property (location, photos, description, amenities).
2. **Room** — the specific room type (name, bed config, photos).
3. **Rate** — the commercial conditions to book that room: cancellation policy (fully/partially/non-refundable, with timeline), board type (meals included), payment method, loyalty programme eligibility, price breakdown, rate code.

Duffel **deduplicates** identical rates across sources and surfaces only the cheapest by default — you don't need your own rate-mapping/dedup layer for Stays specifically.

### Flow (4 calls)
```
Search (dates, guests, location/lat-long+radius) → search_result_id
  → Fetch all rates for a result → rate_id
    → Create quote (re-validates price/availability) → quote_id
      → Create booking (quote_id + guest details) → confirmed booking
```
The quote step exists specifically to protect you from charging a stale price — always requote immediately before charging the customer.

Sources: [Stays Key Concepts](https://duffel.com/docs/api/overview/stays-key-concepts), [Getting Started with Stays](https://duffel.com/docs/guides/getting-started-with-stays), [Accommodation API](https://duffel.com/docs/api/v2/accommodation), [Bookings API](https://duffel.com/docs/api/v2/bookings/get-booking)

---

## 4. Ceiling on "How Much Data Can I Get"

Practical answer: **you get everything the underlying content source (NDC/GDS/LCC or hotel supplier) exposed to Duffel** — Duffel doesn't truncate airline data, but it also can't invent fields an airline never published. Concretely:

- Full fare rules, baggage allowance, seat maps, and loyalty support **only when the airline/NDC source provides them** — GDS/LCC fares are sometimes thinner (e.g., no branded fare name, no loyalty accrual field).
- `available_services` (bags, seats) only returns on the **single-offer** fetch, not the list-offers response — plan your UI flow around fetching the single offer before showing add-ons.
- CO₂ emissions, private/corporate fares, and identity-document requirements are opt-in fields present only when applicable — don't assume every offer has them.
- Seat maps are a **separate endpoint**, not embedded in the offer — call it explicitly, and only after an offer is selected.

### Operational limits to design around
- **Rate limit**: default 120 requests/60s for search in live mode; exceeding it returns `rate_limit_error` with a `ratelimit-reset` header. ([Duffel rate limit](https://help.duffel.com/hc/en-gb/articles/10229200096786-What-is-the-API-rate-limit))
- **Offer expiry**: ~30 minutes — you cannot book an expired offer; you must re-search.
- **Webhooks**: at-least-once delivery, unordered, retried up to 72 hours with exponential backoff; every event carries an `idempotency_key` for you to dedupe. ([Webhooks](https://duffel.com/docs/api/webhooks), [Receiving Webhooks](https://duffel.com/docs/guides/receiving-webhooks))
- **Sandbox vs live**: `live_mode` field on every object; test API keys hit a sandbox with fake airlines for booking flows without spending money.

---

## 5. Integration Architecture for This Repo

### Where it plugs in
The frontend (`app/web`) already has a fixed contract: `GET /api/v1/flights` and `GET /api/v1/hotels`, returning a normalized shape (flat `Flight`/`Hotel` objects, not raw Duffel objects). Whatever supplier you pick, you need a **normalization/adapter layer** — this was true for PKFare, was planned for Amadeus, and is equally true for Duffel. Don't leak Duffel's offer/slice/segment shape directly to the frontend; map it to your existing DTOs.

Recommended layering inside `app/Backend` (NestJS):

```
FlightsController / HotelsController        (matches /api/v1/flights, /api/v1/hotels)
        │
FlightsService / StaysService                (your business logic, caching, orchestration)
        │
DuffelModule
  ├─ DuffelHttpClient      (wraps official Duffel Node SDK or raw HTTP, holds API key/base URL)
  ├─ DuffelOfferMapper      (Offer → your Flight DTO)
  ├─ DuffelStaysMapper      (Accommodation/Rate → your Hotel DTO)
  └─ DuffelWebhookController (signature verification + dedupe by idempotency_key)
```

Keeping `DuffelModule` isolated (mirroring the old `PkfareModule` pattern already used in this repo's history) means a future supplier swap or multi-supplier aggregation only touches this module, not controllers or frontend contracts.

### Order/booking data ownership
Duffel is the source of truth for the **airline-side reservation** (PNR, ticketing, airline-initiated changes), but it is **not** your system of record for your own business — you still need your own `orders`/`bookings` table (Postgres, via Prisma — already removed but was present in the old `app/api`) storing: your internal order id, the Duffel order id + booking reference, price charged to customer vs Duffel cost (your margin), passenger snapshot, payment reference, and status. This is required for customer support, refunds, reporting, and reconciliation independent of Duffel's API being up.

---

## 6. Should You Use a Message Queue?

**Recommendation: yes, but scoped narrowly — not for the search/booking request path itself.**

| Flow | Sync or Queue? | Why |
|---|---|---|
| Flight/hotel **search** | Synchronous | User is actively waiting on screen; queuing adds latency for no benefit. Cache instead (see Redis below). |
| **Create order** (booking + payment) | Synchronous for the critical path | The user needs an immediate success/failure result to know if they're booked. This is a single call to Duffel, not a multi-service saga — no need for orchestration complexity here since Duffel itself owns the airline-side transaction. |
| Post-booking side effects (confirmation email, loyalty ledger update, analytics event, internal notifications) | **Queue** | Non-critical to the user's immediate response; failures here shouldn't fail the booking. |
| **Webhook ingestion** (order changes, airline-initiated changes, payment events) | **Queue** | Duffel expects a fast 2xx ack and retries for 72h on failure. Best practice: webhook controller does signature verification + dedupe by `idempotency_key`, pushes a job, returns 200 immediately, and a worker processes it. Prevents slow downstream logic from causing Duffel to see timeouts and retry-storm you. |
| **Offer-expiry / hold-order payment deadline reminders** | Queue (delayed jobs) | Held orders have a `payment_required_by` deadline — a delayed job to notify the user or auto-release the hold is a natural fit for a job queue, not a cron-polling loop. |
| Order **cancellation/change** confirmations | Sync call to Duffel, then queue the notification | Same critical-vs-side-effect split as booking. |

**Practical pick for this stack**: **BullMQ** (Redis-backed, has a first-class `@nestjs/bullmq` integration) rather than RabbitMQ/Kafka/SQS. At this project's current scale (single supplier, no cross-service saga yet), a full event-broker (Kafka/RabbitMQ) is over-engineering — the "event-driven microservices with sagas and outbox pattern" architecture referenced below only earns its complexity once you're orchestrating multiple independent services/suppliers with compensating transactions. You aren't there yet; a Redis-backed job queue for webhooks + notifications + delayed reminders covers the real need.

Source pattern reference: [Event-Driven Microservices for Booking Systems](https://dev.to/airtruffle/event-driven-microservices-for-booking-systems-managing-distributed-transactions-at-scale-4pai)

---

## 7. Should You Use Redis? — Yes, for Three Distinct Jobs

1. **Cache** — short-TTL (1–5 min) cache of search results keyed by normalized search params (origin/destination/dates/pax for flights; location/dates/guests for stays). Cuts duplicate Duffel calls for repeat/back-button searches and helps you stay under the 120 req/60s rate limit across horizontally-scaled backend instances.
2. **Ephemeral multi-step state** — Stays' `search_result_id → rate_id → quote_id` chain and any multi-step flight search flow are naturally short-lived session state; store them in Redis with a TTL matching Duffel's own expiry windows instead of a database table.
3. **Distributed locking / idempotency** — guard the "create order" endpoint with a Redis-based lock or SETNX-style idempotency key on `(user_id, offer_id)` so a double-click or client retry can't create two orders for the same offer before the first request completes. This is the same pattern OTA references use to prevent duplicate bookings.
4. **Rate-limit coordination** — if you scale to multiple backend instances, a Redis token bucket keeps you collectively under Duffel's per-key rate limit rather than each instance tracking its own local counter.

Since BullMQ already requires Redis as its backing store, one Redis instance serves both the cache and queue needs — no separate infrastructure.

Source pattern reference: [System Design: Hotel Booking (OTA)](https://medium.com/@ankit.vashishta/system-design-hotel-booking-ota-like-booking-com-makemytrip-expedia-airbnb-etc-6e5d26e05d9e)

---

## 8. Broader OTA System Design Reference

For when this platform grows beyond a single supplier / single backend service, the patterns that recur across OTA architecture write-ups (Booking.com-style Reservations API docs, Medium/dev.to system-design breakdowns):

- **Polyglot persistence**: relational DB (Postgres) as the transactional source of truth for orders/bookings (ACID matters here — money and legal contract), a search index (OpenSearch/Elasticsearch) only once you're aggregating *multiple* suppliers and need fast multi-criteria filtering over large denormalized inventory, and Redis for the read-heavy/ephemeral layer described above. A single-supplier Duffel integration doesn't need a search index yet — Duffel's own API is your search index.
- **Supplier Adapter layer**: one normalization module per supplier (`DuffelModule` today, potentially `AmadeusModule`/`PkfareModule` later) that maps into one canonical internal model, so controllers and frontend never see supplier-specific shapes. You already have precedent for this in the deleted `PkfareModule`.
- **Idempotency keys** on the booking endpoint (`(user, offer/rate)` or a client-generated request id) to make retried booking requests safe — this is the single most load-bearing pattern across every OTA design reference found.
- **Soft-hold with TTL** for inventory reservation during payment — largely Duffel's problem for single-supplier flights/stays (it manages the offer/quote expiry), but becomes *your* problem again if you ever hold inventory across multiple suppliers simultaneously.
- **Saga / outbox pattern** — only relevant once booking a single order requires coordinating multiple independent services with their own datastores (e.g., payment service + loyalty service + internal ledger service as separate deployables). At current scope (one NestJS backend, one supplier), a single DB transaction wrapping "charge payment, write order row, enqueue notification job" is sufficient — don't adopt saga/outbox prematurely.
- **Webhook-driven state sync**: treat Duffel webhooks as the mechanism that keeps your local `orders` table in sync with airline-initiated changes (schedule changes, cancellations) rather than polling Duffel.

Sources: [Event-Driven Microservices for Booking Systems](https://dev.to/airtruffle/event-driven-microservices-for-booking-systems-managing-distributed-transactions-at-scale-4pai), [System Design: Hotel Booking OTA](https://medium.com/@ankit.vashishta/system-design-hotel-booking-ota-like-booking-com-makemytrip-expedia-airbnb-etc-6e5d26e05d9e), [Booking.com Reservations API Overview](https://developers.booking.com/connectivity/docs/reservations-api/reservations-overview)

---

## 9. Summary Recommendation for This Repo

| Decision | Recommendation |
|---|---|
| Supplier | Duffel, via an isolated `DuffelModule` in `app/Backend`, mirroring the old `PkfareModule` isolation pattern |
| Message queue | Yes — **BullMQ** (Redis-backed) scoped to: webhook processing, notifications, delayed hold/expiry reminders. Not for the live search/booking request path. |
| Redis | Yes — single instance serving search-result cache, ephemeral multi-step search state, booking idempotency locks, and as BullMQ's backing store |
| Search index (Elasticsearch/OpenSearch) | Not yet — only justified once aggregating multiple suppliers |
| Saga/outbox pattern | Not yet — single DB transaction is sufficient at current scope; revisit if adding independent payment/loyalty microservices |
| Own DB for orders | Required regardless of supplier — Duffel is not your business system of record |
| Env vars needed | `DUFFEL_API_KEY` (test + live), `DUFFEL_WEBHOOK_SECRET`, `REDIS_URL` |
