# TravelHub — Sequence Diagrams (Race-Prone Flows)

**Status:** Draft v1
**Inputs:** [booking_state_machine.md](booking_state_machine.md) (transition numbers T1–T9 referenced below), [erd.md](erd.md), [duffel_api_integration_guide.md](duffel_api_integration_guide.md).

These diagrams cover the paths where ordering and failure matter. The happy path is included once for orientation; everything after it is a failure/race scenario the implementation must pass E2E tests for (roadmap §3).

---

## 1. Happy path — search → book → pay → confirm

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as app/web
    participant API as Backend API
    participant R as Redis
    participant DB as Postgres
    participant S as Stripe
    participant D as Duffel

    U->>W: search flights
    W->>API: GET /flights/search
    API->>R: cache check (normalized params)
    alt cache miss
        API->>D: create offer request
        D-->>API: offers
        API->>R: cache (TTL ≤ 2 min, ≤ min expires_at)
    end
    API-->>W: normalized offers
    U->>W: select offer
    W->>API: POST /bookings {offer_id}
    API->>D: GET single offer (revalidate, fresh expires_at)
    API->>DB: Booking(pending) + FlightOfferSnapshot + idempotency key  [T1]
    U->>W: passenger details
    W->>API: PUT /bookings/:id/passengers
    API->>DB: Passengers, Booking → awaiting_payment, Payment(pending)  [T2]
    API->>S: create PaymentIntent
    API-->>W: client_secret + countdown from expires_at
    U->>S: pay (Stripe Elements — card data never touches us)
    S-->>API: webhook payment_intent.succeeded
    API->>DB: dedupe event, Payment → succeeded, Booking → paid  [T4]
    API->>D: POST /air/orders (metadata: our idempotency key, timeout 130s)
    D-->>API: 201 order {id, booking_reference, documents[]}
    API->>DB: Booking → confirmed, Documents  [T5]
    API->>R: enqueue: PDF generation, confirmation email
```

---

## 2. Crash between payment success and order persistence (the double-book trap)

Duffel has no idempotency key — recovery is reconciliation, never blind retry.

```mermaid
sequenceDiagram
    autonumber
    participant API as Backend API
    participant DB as Postgres
    participant D as Duffel
    participant Q as Reprocessing worker

    Note over API,DB: Booking is `paid` (T4 done)
    API->>D: POST /air/orders (metadata: idempotency key K)
    D-->>D: order created supplier-side
    Note over API: 💥 crash / timeout before response persisted
    Note over DB: Booking stuck in `paid`, supplier_order_id null

    alt recovery via webhook
        D-->>API: webhook order.created (wev_… id, idempotency_key = ord_…)
        API->>DB: store SupplierWebhookEvent (dedupe on wev_ id)
        Q->>DB: sweep processed_at IS NULL
        Q->>D: GET order ord_… → metadata contains K
        Q->>DB: match K → Booking → confirmed  [T5]
    else recovery via polling
        Q->>D: GET /air/orders?created_after=… (reconciliation window)
        alt order found with metadata K
            Q->>DB: Booking → confirmed  [T5]
        else verified absent after window (15 min)
            Q->>DB: Booking → order_failed, auto-Refund created  [T6]
        end
    end
    Note over Q,D: NEVER re-POST /air/orders from `paid` — that creates a second real order
```

---

## 3. Webhook races: early arrival and duplicate delivery

```mermaid
sequenceDiagram
    autonumber
    participant D as Duffel
    participant WH as Webhook controller
    participant DB as Postgres
    participant Q as Reprocessing worker

    par order.created arrives BEFORE our create-order call returns
        D-->>WH: order.created (wev_A)
        WH->>WH: verify signature
        WH->>DB: insert SupplierWebhookEvent wev_A (booking_id null — no match yet)
        WH-->>D: 200 (fast ack, work deferred)
        Note over DB: create-order response lands later, sets supplier_order_id
        Q->>DB: sweep unmatched events → ord_… now matches → processed  [T5 idempotent no-op]
    and duplicate delivery of the same event
        D-->>WH: order.created (wev_A again — at-least-once)
        WH->>DB: insert wev_A → unique(supplier, supplier_event_id) violation
        WH-->>D: 200 (already have it — ack, don't error)
    end
```

Same pattern applies to Stripe events via `PaymentWebhookEvent` unique `(provider, provider_event_id)`.

---

## 4. Offer expires mid-checkout

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as app/web
    participant API as Backend API
    participant DB as Postgres

    Note over W: countdown (from re-fetched expires_at) hits 0
    W->>W: disable pay button immediately
    U->>W: attempts to pay anyway (stale tab)
    W->>API: POST /bookings/:id/payment-intent
    API->>DB: guard: snapshot.expires_at < now
    API-->>W: 409 OFFER_EXPIRED
    API->>DB: Booking → failed (reason offer_expired)  [T3]
    W-->>U: "This fare expired — search again" + re-search CTA
    Note over API: expiry sweep also catches abandoned tabs that never retried
```

Edge case: payment succeeds in the same second the offer dies → T4 still applies (money is real), then order creation gets a Duffel 4xx → `order_failed` → auto-refund (diagram 2's else-branch). The user is never silently charged for nothing.

---

## 5. Cancellation & refund (user-initiated, auto-approved)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as app/web
    participant API as Backend API
    participant DB as Postgres
    participant D as Duffel
    participant S as Stripe

    U->>W: cancel booking
    W->>API: GET /bookings/:id/cancellation-quote
    API->>DB: read snapshot.conditions (captured at booking time)
    API-->>W: refundable? penalty? customer receives: supplier refund + full markup
    U->>W: confirm (penalty disclosed BEFORE this click)
    W->>API: POST /bookings/:id/cancel
    API->>D: create + confirm order cancellation
    D-->>API: cancellation {refund_amount}  (airline-determined, often < paid)
    API->>DB: Booking → cancelled, Refund(pending, amount = supplier refund + markup)  [T7]
    API->>S: create refund (amount per PRD §5.4 policy)
    S-->>API: webhook refund.succeeded / charge.refunded
    API->>DB: Refund → succeeded, Payment rollup, Booking → refunded  [T8]
    API-->>U: email: refund completed (initiator + reason on record)
```

Non-auto-approvable fares route to `technical_admin` after the quote step instead of calling Duffel directly.

---

## 6. Airline schedule change (post-booking supplier event)

```mermaid
sequenceDiagram
    autonumber
    participant D as Duffel
    participant WH as Webhook controller
    participant DB as Postgres
    participant Q as Worker
    actor U as User

    D-->>WH: order.airline_initiated_change_detected (wev_…)
    WH->>DB: store event (dedupe), ack 200
    Q->>D: GET order → updated slices/segments
    Q->>DB: update stored Segments (local times + tz), flag booking "schedule changed"
    Q->>U: email: your flight time changed (old vs new)
    Note over DB: PRD §5.5 — stored itinerary must never be stale after an ingested event.<br/>Accept/rebook handling is manual via technical_admin in Phase 1
```

---

## 7. Payment failure and retry (offer still alive)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as app/web
    participant API as Backend API
    participant DB as Postgres
    participant S as Stripe

    U->>S: pay → declined
    S-->>API: webhook payment_intent.payment_failed
    API->>DB: PaymentAttempt(1) → failed (failure_reason), Booking stays awaiting_payment
    API-->>W: retry available (offer unexpired — countdown still running)
    U->>W: retry with another card
    W->>API: POST /bookings/:id/payment-intent (retry)
    API->>S: new PaymentIntent
    API->>DB: PaymentAttempt(2) — NEW row, attempt 1 never mutated
    S-->>API: webhook payment_intent.succeeded → T4 as normal
```
