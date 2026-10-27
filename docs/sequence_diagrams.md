# TravelHub — Sequence Diagrams (Race-Prone Flows)

**Status:** Verified against code 2026-10-27 (main @ b176f47)
**Inputs:** [booking_state_machine.md](booking_state_machine.md) (transition numbers T1–T9 referenced below), [erd.md](erd.md), [duffel_api_integration_guide.md](duffel_api_integration_guide.md), [archive/prd.md](archive/prd.md) §5.3–5.5.

These diagrams cover the paths where ordering and failure matter, as the backend implements them today. Participant names are the real NestJS classes under `app/Backend/src/`; messages name the real methods and endpoints. The gateway is **Paymob**, the supplier is **Duffel**.

---

## 1. Create booking with idempotency (T1)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as app/web
    participant C as BookingsController
    participant R as Redis
    participant S as BookingsService
    participant D as DuffelService
    participant DB as Postgres

    U->>W: select offer
    W->>C: POST /bookings {offer_id} + Idempotency-Key
    C->>R: GET idempotency_booking:key
    alt key = locked
        C-->>W: 409 ILLEGAL_TRANSITION (in progress)
    else key = booking id
        C->>S: getBookingDetail(user, id)
        C-->>W: 200 existing booking (replay)
    else no key
        C->>R: SETEX key 120s locked
        C->>S: createBooking(user, offer_id)
        S->>R: checkOutboundRateLimit (token bucket)
        S->>D: fetchOffer(offer_id)
        D-->>S: offer with fresh expires_at
        alt expires_at passed
            S-->>C: 410 OFFER_EXPIRED
            C->>R: DEL key (unlock for retry)
        else offer alive
            S->>S: MarkupService.calculateMarkup
            S->>DB: Booking(pending) + FlightOfferSnapshot + Slices/Segments + initial history [T1]
            S-->>C: booking + passenger_requirements
            C->>R: SETEX key 24h booking id
            C-->>W: 201 booking
        end
    end
    U->>W: passenger details
    W->>C: PUT /bookings/:id/passengers
    C->>S: savePassengers(user, id, passengers)
    S->>DB: lock booking FOR UPDATE, check pending and expires_at
    S->>DB: Passenger rows, Booking → awaiting_payment [T2]
    S-->>W: {booking_id, status, total_amount, currency}
```

Without an `Idempotency-Key` header the controller calls `createBooking` directly and a double-click creates two `pending` bookings. `savePassengers` returns a vestigial `client_secret: pi_mock_…` field that nothing consumes.

---

## 2. Pay via Paymob — intent → iframe → return page → webhook

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as app/web payment page
    participant PC as PaymentsController
    participant PS as PaymentsService
    participant PM as PaymobService
    participant P as Paymob
    participant WH as WebhooksController
    participant Q as payment_webhook_queue
    participant PR as PaymentWebhookProcessor
    participant DB as Postgres

    W->>PC: POST /bookings/:id/payment-intent
    PC->>PS: createOrGetPaymentAttempt(user, id)
    PS->>DB: lock booking, require awaiting_payment
    alt snapshot.expires_at passed
        PS->>DB: Booking → failed (offer_expired) [T3] then commit
        PS-->>W: 409 OFFER_EXPIRED
    else offer alive
        PS->>DB: Payment(pending) if none yet
        PS->>PM: createPaymentKey(total, currency, merchant_order_id, billing)
        PM->>P: POST /auth/tokens
        PM->>P: POST /ecommerce/orders (amount in EGP via toPaymobGatewayAmount)
        PM->>P: POST /acceptance/payment_keys
        P-->>PM: order id + payment token
        PS->>DB: PaymentAttempt(requires_action, provider_reference_id = paymob order id)
        PS-->>W: {payment_token, iframe_url}
    end
    W->>P: open iframe with payment_token
    U->>P: card details (never touch our servers)

    par webhook path (authoritative)
        P->>WH: POST /webhooks/paymob?hmac=… {type TRANSACTION, obj}
        WH->>PM: verifyTransactionHmac(obj, hmac)
        WH->>DB: PaymentWebhookEvent (provider_event_id = txn id + event type)
        WH->>Q: add process_webhook {eventId, requestId}
        WH-->>P: 200 {received}
        Q->>PR: process(job)
        PR->>DB: lock event, skip if processed_at set
        PR->>DB: PaymentAttempt by provider_reference_id = obj.order.id
        alt attempt not found yet
            PR-->>Q: throw (no BullMQ retry policy)
            Note over DB,Q: processed_at stays NULL, PaymentWebhookSweepService re-enqueues after 1 min
        else transaction.succeeded and amount matches
            PR->>DB: lock booking, Booking → paid [T4]
            PR->>DB: attempt → succeeded, Payment → succeeded, ledger customer_payment, processed_at
            PR->>PR: after commit, enqueue create_duffel_order
        else transaction.failed
            PR->>DB: attempt → failed (failure_reason), booking stays awaiting_payment
        end
    and return path (informational only)
        P->>W: navigate iframe to /checkout/payment-return?merchant_order_id=bookingId:suffix
        W->>W: window.top.location = /checkout/payment?booking_id=…
        loop every 3 s
            W->>PC: GET /bookings/:id
            alt status awaiting_payment
                Note over W: webhook not processed yet, keep waiting (no new payment-intent)
            else status paid
                Note over W: show "confirming" screen
            else status confirmed
                W->>W: redirect /checkout/confirmation
            else status order_failed or failed
                W->>W: show failure screen
            end
        end
    end
```

The return page carries no outcome and sets no state. If the user lands back before the webhook has been processed, the booking still reads `awaiting_payment` and the page simply keeps polling. If the webhook arrives before `PaymentAttempt` is committed, the processor throws and the sweep replays the event a minute later. A `transaction.pending` callback (3DS in flight) is stored, acked and marked processed without touching the attempt.

Retry after a decline: the user calls `POST /bookings/:id/payment-intent` again while still `awaiting_payment`; a **new** attempt with a fresh Paymob order (`merchant_order_id` suffix) is created; the failed attempt is never mutated.

---

## 3. Order fulfillment — job → createOrder → order.created fast path vs reconciliation sweep

```mermaid
sequenceDiagram
    autonumber
    participant Q as order_fulfillment_queue
    participant OF as OrderFulfillmentService
    participant D as DuffelService
    participant DF as Duffel
    participant FO as FulfillmentOutcomeService
    participant DB as Postgres
    participant DWC as DuffelWebhooksController
    participant DWP as DuffelWebhookProcessor
    participant RS as DuffelReconciliationService

    Q->>OF: fulfillOrder(bookingId) (attempts 1, never throws)
    OF->>DB: booking still paid? snapshot, passengers
    OF->>D: createOrder(offer, passengers, metadata supplier_idempotency_key)
    loop up to 4 requests on 503 (2s, 5s, 10s backoff)
        D->>DF: POST /air/orders (timeout 130 s)
    end
    alt 2xx
        DF-->>D: order {id, booking_reference, documents}
        OF->>FO: confirmPaidBooking(manager, id, order) in a transaction
        FO->>DB: lock booking, only if still paid
        FO->>DB: supplier_order_id, booking_reference, Booking → confirmed [T5], ledger supplier_charge, Documents
        FO-->>OF: applied = true
        OF->>FO: sendConfirmationEmail(id) after commit (PDF + email, best-effort)
    else 4xx DuffelDefinitiveError
        OF->>FO: failPaidBookingAndRefund(id, reason, supplier_order_rejected)
        FO->>DB: lock booking, Booking → order_failed [T6], Refund(pending, total_amount)
        FO->>FO: enqueueRefund after commit (see diagram 4)
    else 500 / 503 after retries / timeout DuffelAmbiguousError
        OF->>OF: log with request_id, booking stays paid
        Note over OF,DB: NEVER re-POST. Recovery below.
    end

    par fast path — order.created webhook
        DF->>DWC: POST /webhooks/duffel (X-Duffel-Signature)
        DWC->>DB: SupplierWebhookEvent (dedupe on wev_ id, 23505 → duplicate ack)
        DWC-->>DF: 200
        DWC->>DWP: duffel_webhook_queue process_duffel_webhook
        DWP->>DB: lock event, skip if processed_at set
        DWP->>DB: booking by supplier_order_id
        alt not linked yet
            DWP->>D: getOrder(ord_…)
            DWP->>DB: booking by metadata.supplier_idempotency_key
        end
        alt booking found and paid
            DWP->>RS: confirmBookingFromOrder(manager, booking, order)
            RS->>FO: confirmPaidBooking [T5]
            DWP->>DB: event processed_at, booking_id
            DWP->>FO: sendConfirmationEmail after commit
        else booking not paid (already confirmed/failed)
            DWP->>DB: event processed_at (replay no-op)
        else no booking matches yet
            Note over DWP,DB: processed_at stays NULL, DuffelWebhookSweepService re-enqueues every minute
        end
    and safety net — reconciliation sweep every 2 min
        RS->>DB: bookings paid with updated_at older than 15 min
        RS->>D: findOrder(match on metadata.supplier_idempotency_key)
        loop GET /air/orders, 50 per page, max 40 pages
            D->>DF: GET /air/orders?after=…
        end
        alt order found
            RS->>FO: confirmPaidBooking [T5] then sendConfirmationEmail
        else complete = true, not found (verified absent)
            RS->>FO: failPaidBookingAndRefund(id, verified absent, order_verified_absent_reconciliation) [T6]
        else complete = false or lookup threw
            Note over RS: absence NOT proven, stay paid, retry next run
        end
    end
```

Whichever of the three paths locks the booking first applies T5; the others find it no longer `paid`, return `false`, and send no email. The sync `createOrder` response landing **after** the webhook already confirmed is therefore a no-op, not a conflict.

---

## 4. Order failed → refund enqueue → refund execution with attempts

```mermaid
sequenceDiagram
    autonumber
    participant FO as FulfillmentOutcomeService
    participant DB as Postgres
    participant Q as refund_execution_queue
    participant RP as RefundExecutionProcessor
    participant RE as RefundExecutionService
    participant PM as PaymobService
    participant P as Paymob
    participant SW as RefundRequeueSweepService

    FO->>DB: Booking → order_failed [T6] + Refund(pending) in one transaction
    FO->>Q: add execute_refund {refundId} jobId refund:id, attempts 5, exp backoff 30 s
    alt Redis add fails
        Note over FO,SW: logged, not thrown. Sweep re-enqueues pending rows older than 5 min
    end

    loop attempt 1..5
        Q->>RP: process(job)
        RP->>RE: executeRefund(refundId)
        RE->>DB: Refund row, no-op unless pending
        RE->>DB: transaction id from stored transaction.succeeded webhook (obj.id)
        RE->>PM: refundTransaction(txn id, EGP amount) outside any transaction
        PM->>P: POST /acceptance/void_refund/refund
        alt gateway ok
            P-->>PM: {id}
            RE->>DB: lock refund, only if still pending
            RE->>DB: Refund → succeeded, ledger gateway_refund, Payment rollup
            alt succeeded refunds >= Payment.amount and booking cancelled/order_failed
                RE->>DB: Booking → refunded [T8/T9]
            end
            RE-->>RP: executed = true
        else gateway error or missing transaction id
            RE-->>RP: throw
            RP-->>Q: rethrow → BullMQ backoff retry
            alt attemptsMade >= 5
                RP->>RE: markRefundFailed (pending → failed)
                Note over RP: surfaces in GET /admin/refunds?status=failed
            end
        end
    end
```

Admin paths reuse the same service: `POST /admin/payments/:id/refund` creates the `pending` row then calls `executeRefund` inline (marking the row `failed` on a throw); `POST /admin/refunds/:id/retry` flips `failed → pending` and re-enqueues with the same job options. Because `jobId` is derived from the refund id, the sweep and the retry endpoint are no-ops while a job is still live or delayed.

---

## 5. User cancellation with quote (T7)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as app/web
    participant C as BookingsController
    participant S as BookingsService
    participant D as DuffelService
    participant DF as Duffel
    participant RE as RefundExecutionService
    participant DB as Postgres
    participant Q as refund_execution_queue

    U->>W: cancel booking
    W->>C: GET /bookings/:id/cancellation-quote
    C->>S: getCancellationQuote(user, id)
    S->>DB: booking (must be confirmed) + snapshot.conditions
    S-->>W: {refundable, requires_admin, penalty, customer_receives estimate}
    U->>W: confirm (penalty shown before this click)
    W->>C: POST /bookings/:id/cancel {reason}
    C->>S: cancelBooking(user, id, reason)
    S->>DB: booking confirmed? (no lock) recompute quote
    alt requires_admin (not refundable or penalty currency mismatch)
        S->>DB: cancellation_requested_at, cancellation_request_reason
        S-->>W: {requires_admin true} booking stays confirmed
    else auto-approvable
        S->>DB: Payment must be succeeded or partially_refunded
        S->>D: cancelOrder(supplier_order_id)
        D->>DF: POST /air/order_cancellations
        D->>DF: POST /air/order_cancellations/:id/actions/confirm
        DF-->>D: {refund_amount, refund_currency}
        Note over S: customer_receives = supplier refund + full markup
        S->>DB: transaction start
        S->>DB: Booking → cancelled [T7]
        S->>RE: createPendingRefund(amount, supplier_refund_amount) if amount > 0
        S->>DB: ledger supplier_refund if supplier refund > 0
        S->>DB: commit
        S->>Q: add execute_refund (diagram 4)
        S-->>W: {status cancelled, supplier_refund_amount, customer_receives, refund}
    end
```

The `cancelled` state and the `pending` `Refund` row commit together, so a gateway outage can never lose the obligation to refund. A cancellation with an airline penalty leaves the payment `partially_refunded` and the booking in `cancelled` permanently — T8 only fires when succeeded refunds cover the full `Payment.amount`. Admin cancellation (`AdminService.cancelBooking`) follows the same sequence with `changed_by_user_id = admin`, an `AuditLog` row, and no payment pre-check (a non-refundable payment skips the refund row with a warning). No email is sent on cancellation or refund.

---

## 6. Airline schedule change (post-booking supplier event)

```mermaid
sequenceDiagram
    autonumber
    participant DF as Duffel
    participant DWC as DuffelWebhooksController
    participant DB as Postgres
    participant DWP as DuffelWebhookProcessor
    participant D as DuffelService
    participant M as MailService
    actor U as User

    DF->>DWC: order.airline_initiated_change_detected (wev_…, idempotency_key = ord_…)
    DWC->>DB: SupplierWebhookEvent (dedupe), ack 200, enqueue
    DWP->>DB: lock event, booking by supplier_order_id
    alt order not linked locally yet
        Note over DWP,DB: processed_at stays NULL, sweep retries every minute
    else booking found
        DWP->>D: getOrder(ord_…)
        DWP->>DB: snapshot slices/segments by position
        DWP->>DB: Segment departing/arriving local + timezones updated
        DWP->>DB: Booking.schedule_change_detected_at = now (status unchanged)
        DWP->>M: sendScheduleChangeEmail(email, bookingId, PNR, changes) fire-and-forget
        M-->>U: email old vs new departure times (only if any segment changed)
        DWP->>DB: event processed_at, booking_id
    end
```

Segments are matched by slice/segment position, not by id. Accept/rebook handling is manual via `technical_admin` (the booking status does not change; `schedule_change_detected_at` is exposed on the booking payload).
