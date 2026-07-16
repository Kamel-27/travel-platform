# PKFare Flight Buyer API — Endpoint Contracts

Concrete request/response contracts for every endpoint on the booking critical path, **copied
from the official apidoc** (`apifox.pkfare.com/apidoc/project-345083`, July 2026). This file is
**self-contained** — an implementer never needs to open the PKFare portal. JSON blocks are the
real documented examples (credentials blanked). Field names are exact.

Read alongside [api-reference.md](./api-reference.md) (transport/auth/status enum) and
[architecture.md](./architecture.md) (how these map to TravelHub DTOs).

## Conventions (all endpoints)

- **Method/URL:** `POST https://api.pkfare.com/json/<name>`
- **Headers:** `Content-Type: application/json`; optional `Accept-Encoding: gzip`.
- **Every request body** includes:
  ```json
  { "authentication": { "partnerId": "<id>", "sign": "<md5(partnerId+partnerKey)>" }, "…": {} }
  ```
- **Every response body:** `{ "errorCode": "0", "errorMsg": "ok", "data": { … } }`.
  `errorCode === "0"` ⇒ success and `data` is populated. Any other code ⇒ failure (`data` null).
- **Booking-flow timing constraints (verified):** `preciseBooking` must run **within 30 min** of
  `precisePricing`; `ticketing` must run **within 30 min** of `orderPricing`; `orderPricing` is
  **mandatory** before `ticketing`.

---

## 1. Shopping — `POST /json/shoppingV9`

Search flights. One-way / round-trip / open-jaw (max 2 legs).

### Request
```json
{
  "authentication": { "partnerId": "", "sign": "" },
  "search": {
    "adults": 1,
    "children": 0,
    "infants": 0,
    "nonstop": 0,
    "airline": "",
    "solutions": 0,
    "tag": "",
    "returnTagPrice": "Y",
    "searchAirLegs": [
      { "cabinClass": "", "departureDate": "2024-12-15", "origin": "HKG", "destination": "BKK", "airline": "SQ" },
      { "cabinClass": "", "departureDate": "2024-12-17", "origin": "BKK", "destination": "HKG", "airline": "SQ" }
    ]
  }
}
```
Request fields: `adults` (req), `children`, `infants`, `nonstop` (0/1), `airline` (comma-separated
IATA filter), `solutions` (suggested result count), `tag`/`returnTagPrice` (branded/product
fares — `returnTagPrice:"Y"` returns multi-product prices), `searchAirLegs[]` each with
`cabinClass` (`""`=lowest, `Y`/`W`/`C`/`F`), `departureDate` (`yyyy-mm-dd`), `origin`,
`destination`, optional `airline`.

### Response (one-way example, trimmed)
```json
{
  "errorCode": "0", "errorMsg": "ok",
  "data": {
    "searchKey": "HKGBKK20241215Y1000",
    "shoppingKey": "f492cad7ce655916d3a19eb3a21bd478",
    "solutions": [
      {
        "solutionKey": "cadce3d7a693476e02a0e841d586fbcb",
        "solutionId": "DMHkxtUMupBvCYeSAZKvI2XPSDdKRK2kK27e…(long opaque token)…",
        "fareType": "PRIVATE",
        "currency": "USD",
        "adtFare": 25.69, "adtTax": 59.39, "chdFare": 0, "chdTax": 0,
        "qCharge": 0, "tktFee": 0, "platformServiceFee": 0, "merchantFee": 0,
        "platingCarrier": "VJ",
        "adults": 1, "children": 0, "infants": 0,
        "journeys": { "journey_0": ["07177e6e653830b4b2e151f215c8fd19"] },
        "baggageMap": {
          "ADT": [ { "segmentIndexList": [1,2], "baggageAmount": "0PC", "carryOnAmount": "1PC", "carryOnWeight": "7KG" } ]
        },
        "miniRuleMap": {
          "ADT": [ { "segmentIndex": [1,2], "miniRules": [
            { "penaltyType": 0, "isPermited": 0, "when": 0, "amount": null, "currencyCode": null, "percent": null },
            { "penaltyType": 1, "isPermited": 0, "when": 0, "amount": null, "currencyCode": null, "percent": null }
          ] } ]
        }
      }
    ],
    "flights": [ /* referenced by solutions[].journeys */ ],
    "segments": [ /* referenced by flights */ ]
  }
}
```
Key points: `solutionId` is a **long opaque token** you carry into pricing/booking. Fares are
**decimals per pax type**. `miniRuleMap`: `penaltyType` **0=refund, 1=change**; `isPermited` 0/1;
`when` time-tier. To render an itinerary, join `solution → journeys → flights[] → segments[]`.

### Notable error codes
`B003` illegal sign · `B024` time-out (retryable) · `B035` concurrency limited · `P004` >9 seat
pax · `P005` need ≥1 adult · `P009` infants > adults · `B039` illegal city/airline.

---

## 2. PrecisePricing — `POST /json/precisePricing_V11`

Re-price a chosen `solutionId` with real-time price + availability. **Mandatory before booking.**

### Request
```json
{
  "authentication": { "partnerId": "", "sign": "" },
  "pricing": {
    "journeys": {
      "journey_0": [
        { "airline": "FD", "flightNum": "501", "departure": "HKG", "departureDate": "2024-12-15",
          "departureTime": "14:40", "arrival": "DMK", "arrivalDate": "2024-12-15", "arrivalTime": "16:40",
          "bookingCode": "Z" }
      ],
      "journey_1": [
        { "airline": "FD", "flightNum": "504", "departure": "DMK", "departureDate": "2024-12-30",
          "departureTime": "15:30", "arrival": "HKG", "arrivalDate": "2024-12-30", "arrivalTime": "19:15",
          "bookingCode": "A" }
      ]
    },
    "adults": 1, "children": 1, "infants": 0,
    "solutionId": "iXf1ufZoOsBU+MpHfwQD6…(from Shopping)…",
    "cabin": "",
    "tag": "SAVER"
  }
}
```
`solutionId` (req) ties back to Shopping. **Direct-pricing fallback:** on pricing failure, retry
with `solutionId: "direct pricing"`. `cabin`: `""`/`Y`/`W`/`C`/`F` (if `bookingCode` set, it wins).

### Response (trimmed)
```json
{
  "errorCode": "0", "errorMsg": "ok",
  "data": {
    "solution": {
      "solutionKey": "cadce3d7…", "solutionId": "DMHkxtUM…(may be re-issued)…",
      "fareType": "PRIVATE", "currency": "USD",
      "adtFare": 25.69, "adtTax": 59.39, "chdFare": 0, "chdTax": 0,
      "tktFee": 0, "platformServiceFee": 0, "journeys": { "journey_0": ["…flightId…"] }
    },
    "flights": [ /* … */ ],
    "segments": [ /* … */ ],
    "ancillaryAvailability": { /* which ancillaries are buyable */ }
  }
}
```
The returned `solutionId` may be **re-issued** — use the one from the pricing response when booking.

### Notable error codes
`B016` flight near take-off · `B020` no price · `B021` 0 seats left · `B024` pricing timeout ·
`B026` last-ticketing-time too soon · `B068` journey ≠ solutionId itinerary.

---

## 3. PreciseBooking — `POST /json/preciseBooking_V7`  ⭐ create order (PNR)

Creates the order and PNR → order status `TO_BE_PAID`. Must follow `precisePricing` within 30 min.

### Request
```json
{
  "authentication": { "sign": "", "partnerId": "" },
  "booking": {
    "passengers": [
      { "passengerIndex": 1, "birthday": "1993-06-22", "firstName": "Mary", "lastName": "Jones",
        "nationality": "PH", "psgType": "ADT", "sex": "F",
        "cardType": "P", "cardNum": "E29384798", "cardExpiredDate": "2027-05-01",
        "ffpNumber": "125003559853", "ffpAirline": "CA", "ktn": "1029490", "redress": "2039401" },
      { "passengerIndex": 2, "birthday": "2021-04-12", "firstName": "Jason", "lastName": "Smith",
        "nationality": "PH", "psgType": "CHD", "sex": "M" },
      { "passengerIndex": 3, "birthday": "2023-11-24", "firstName": "Laura", "lastName": "Smith",
        "nationality": "PH", "psgType": "INF", "sex": "F", "associatedPassengerIndex": 1 }
    ],
    "solution": {
      "solutionId": "OqDCC1j2GhG9XTKOd0/KF+…(from PrecisePricing)…",
      "adtFare": 117.25, "adtTax": 59.11, "chdFare": 108.87, "chdTax": 59.11,
      "infFare": 28.45, "infTax": 0,
      "journeys": {
        "journey_0": [
          { "airline": "FD", "flightNum": "503", "departure": "HKG", "departureDate": "2024-12-30",
            "departureTime": "22:20", "arrival": "DMK", "arrivalDate": "2024-12-31", "arrivalTime": "00:20",
            "bookingCode": "A" }
        ]
      }
    },
    "contact": {
      "name": "AndyGuan", "email": "andy@example.com", "telCode": "+86", "mobile": "17826050868",
      "buyerEmail": "buyer@example.com", "buyerTelCode": "+86", "buyerMobile": "18066793072"
    },
    "buyerOrder": "your-internal-ref",
    "ancillary": [ /* optional; from AncillaryPricing */ ]
  }
}
```
Passenger fields: `passengerIndex` (1-based, continuous), `firstName`, `lastName`, `birthday`,
`nationality`, `psgType` (`ADT`/`CHD`/`INF`), `sex` (`M`/`F`). **Document fields** `cardType`
(`P`/`N`/`O`), `cardNum`, `cardExpiredDate` are **required for many international itineraries**
(error `B065` if missing when required). Infants set `associatedPassengerIndex` → responsible
adult. `ffpNumber`/`ffpAirline`/`ktn`/`redress` optional. `buyerOrder` stores **your** reference
on PKFare's side (use the TravelHub `supplierIdempotencyKey`).

### Response (without ancillary, trimmed)
```json
{
  "errorCode": "0", "errorMsg": "ok",
  "data": {
    "orderNum": "917132752968703001",
    "pnr": "WC7JP4",
    "solution": { "solutionKey": "0bbef6a2…", "solutionId": "OqDCC1j2…", "fareType": "PRIVATE",
                  "currency": "USD", "adtFare": 117.25, "adtTax": 59.11, "chdFare": 108.87,
                  "chdTax": 59.11, "infFare": 28.45, "infTax": 0 },
    "flights": [ /* … */ ],
    "segments": [ /* … */ ]
  }
}
```
Store `data.orderNum` in `booking.supplierOrderId` immediately, and `pnr` in `bookingReference`.

### ⚠️ Ambiguity-critical error codes (drive the recovery matrix)
- **`B006` "Reservation failed - Other. OrderNum is XXX"** — booking failed **but an order WAS
  created** (id in the message). **Do NOT retry** — treat as ambiguous, reconcile via `orderDetail`.
- `B005` no matching precisePricing within 30 min (re-price first) · `B017` price changed ·
  `B008` itinerary differs (schedule change) · `B011` fare unavailable · `B012`/`B028` PNR
  create/booking timeout (ambiguous) · `B029` duplicate reservation (an equivalent order exists) ·
  `B087` churning detected · `0307` booking class sold out.
- Definitive validation: `B004`/`B022`/`B077` bad pax ages · `B062`/`B064` name length ·
  `B065` missing documents · `B078`/`B079`/`B080` infant/passengerIndex errors.

---

## 4. OrderPricing — `POST /json/orderPricingV5`  (mandatory pre-payment check)

Re-validates PNR + price before paying. **Mandatory before `ticketing`; ticket within 30 min.**

### Request
```json
{ "authentication": { "partnerId": "", "sign": "" }, "orderPricing": { "orderNum": "917131658934384601" } }
```

### Response (trimmed)
```json
{
  "errorCode": "0", "errorMsg": "ok",
  "data": {
    "pricingResult": {
      "solution": { "fareType": "PRIVATE", "currency": "CNY", "adtFare": 2862, "adtTax": 1211,
                    "chdFare": 0, "chdTax": 0, "qCharge": 0, "tktFee": 0, "platformServiceFee": 0,
                    "merchantFee": 0, "adults": 1, "children": 0, "infants": 0,
                    "journeys": { "journey_0": ["…flightId…"] } },
      "flights": [ { "flightId": "…", "journeyTime": 360, "transferCount": 1,
                     "lastTktTime": "2023-11-09 13:47:00", "segmengtIds": ["…","…"] } ],
      "segments": [ /* … */ ]
    },
    "orderResult": { /* … */ }
  }
}
```

### Notable error codes
`B116` **price changed** · `B115` last-ticketing-time expired · `B112` already paid ·
`B114` flight changed · `B113` filed fare ≠ order price · `B103` no airline PNR.

If `B116`/`B113` (price changed): re-quote and decide (abort/refund vs re-collect). Maps to
TravelHub's "offer price changed" handling.

---

## 5. Ticketing — `POST /json/ticketing`  ⭐ pay from wallet + issue

Deducts credits from the **prepaid wallet** and requests issuance → status `ISS_PRC`. Ticket
numbers arrive later via `TicketIssuanceNotify_V2` or `orderDetail`.

### Request
```json
{
  "authentication": { "partnerId": "", "sign": "" },
  "ticketing": { "orderNum": "1012674912", "PNR": "KHZ1WU", "email": "pax@example.com",
                 "name": "Jango/Wang", "telNum": "13249073855" }
}
```

### Response
```json
{ "errorCode": "0", "errorMsg": "ok",
  "data": { "orderNum": "1012704540", "orderAmount": 2015, "transactionExpense": 2.02, "payAmount": 2017.02 } }
```

### Notable error codes
- **`B022` "Ticketing failed" — balance not enough** ⇒ prepaid wallet underfunded (definitive;
  top up then retry). Surface to admin health.
- `B024` **order already paid** (idempotent — treat as success/no-op) · `B009` order status
  invalid · `B010` order not found.

---

## 6. OrderDetail — `POST /json/orderDetail/v13`  ⭐ reconciliation source of truth

Authoritative order status, PNR, ticket numbers, journeys, ancillaries, schedule-change history.

### Request
```json
{
  "authentication": { "partnerId": "", "sign": "" },
  "data": {
    "orderNum": "917133223962851001",
    "includeFields": "passengers,journeys,solutions,ancillary,scheduleChange,checkinInfo",
    "includeOrderTypes": ["O", "R"]
  }
}
```
`includeFields` — `passengers`, `journeys`, `solutions` are required; `ancillary`,
`scheduleChange`, `checkinInfo` optional. `includeOrderTypes` — `O`riginal / `C`hange / `R`efund
/ `V`oid.

### Response (issued order, trimmed)
```json
{
  "errorCode": "0", "errorMsg": "ok",
  "data": {
    "orderStatus": "ISSED",
    "orderNum": "917070354395357001",
    "refOrderNum": "9170703543953570",
    "orderType": "O",
    "createdTime": "2024-02-04 16:30:40",
    "pnr": "6y6d34", "airPnr": "C3pyn0", "platingCarrier": "VJ",
    "payGate": "Prepay", "paySerialNum": "PREPAY_20240204163055_917070354395357001_2477",
    "passengers": [
      { "firstName": "SHASHA", "lastName": "XIA", "psgType": "ADT", "nationality": "CN", "sex": "M",
        "birthday": "2003-03-23", "cardType": "P", "cardNum": "E11887134", "cardExpiredDate": "2027-03-31",
        "ticketNum": "C3pyn0", "passengerIndex": 1,
        "seats": [ { "airline": "VJ", "flightNum": "813", "seatNum": "30C" } ] }
    ],
    "journeys": [
      { "journeyTime": 145, "transferCount": 0,
        "segments": [
          { "airline": "VJ", "flightNum": "813", "equipment": "321", "cabinClass": "ECONOMY",
            "bookingCode": "T", "departure": "SGN", "arrival": "SIN", "departureTerminal": "2",
            "arrivalTerminal": "4", "departureDate": "2024-03-04", "arrivalDate": "2024-03-04",
            "departureTime": "06:50", "arrivalTime": "10:15", "flightTime": 145, "codeShare": "N" } ] }
    ],
    "solutions": [
      { "currency": "CNY", "adtFare": 1574, "adtTax": 291, "tktFee": 0, "merchantFee": 0,
        "distCost": 0, "coupon": 0, "buyerAmount": 1865 }
    ],
    "lastTktTime": "2024-02-04 18:30:00",
    "ancillaryItems": [ /* … */ ]
  }
}
```
For reconciliation, read **`orderStatus`** (→ [status enum](./api-reference.md#7-order-status-lifecycle-verified-enum)),
`passengers[].ticketNum`, and `pnr`/`airPnr`.

### Notable error codes
`B037` order not found · `B048` invalid buyer (order belongs to another partner) · `S002` timeout.

---

## 7. CancelOrder — `POST /json/cancel`  (pre-ticketing only)

Cancels an order/PNR **before ticketing** (status must be `TO_BE_PAID`).

### Request / Response
```json
{ "authentication": { "partnerId": "", "sign": "" },
  "cancel": { "orderNum": "917132752968703001", "virtualPnr": "WC7JP4" } }
```
```json
{ "errorCode": "0", "errorMsg": "OK" }
```
`B009` order status invalid (not `to_be_paid` — use Refund APIs instead) · `B041` already
cancelled · `B010`/`B037` order not found.

---

## 8. RequestTicketing — `POST /json/requestTicketing`

Variant of `ticketing` to **request** issuance (used where ticketing isn't an immediate wallet
deduction). Same order lifecycle; ticket numbers still arrive via notify/`orderDetail`.
`TODO(pkfare-verify)`: capture full schema at implementation time if this path is used instead of
`ticketing`.

---

## 9. Refund APIs (async, post-ticketing)

Post-ticket cancellation/refund is a **multi-step async flow** (not the sync `cancel`):

```
refundPricing/generate   → refund quote (refundPricingId, amounts)
refundPricing/check      → validate a refund quote
refund-api/refundRequest → submit the refund → creates a refund order
refund-api/checkRefund   → poll refund order status
refundReimburse/check    → poll reimbursement to wallet
+ webhooks: RefundResultNotify, ReimbursedResultNotify
+ uploadAttachmentFile / downloadAttachmentFile (supporting docs)
```

### RefundRequest — `POST /json/refund-api/refundRequest` (request, trimmed)
```json
{
  "authentication": { "sign": "", "partnerId": "" },
  "data": {
    "orderNum": "916783290901993901",
    "allPaxOfOrder": 1,
    "refundPricingId": "16787330658156729",
    "refundType": 0,
    "refundReason": 0,
    "contactPerson": "…", "email": "…", "telNum": "…",
    "uploadFilesIds": [],
    "pnrList": [
      { "pnr": "EDTCZP", "airPnr": "EDTCZP", "flightNum": "CX635", "departure": "HKG",
        "arrival": "SIN", "cabinClass": "ECONOMY", "bookingCode": "E" }
    ],
    "canceledReservationBeforeDeparture": 0
  }
}
```
`refundType` 0=voluntary / 1=involuntary. `refundReason` 0=personal, 1=illness, 2=schedule change,
3=crisis, 4=visa refusal. `allPaxOfOrder` 1 ⇒ `pnrList` must contain **all** pax+segments.
Refund status flows `UNDER_REVIEW → REFD_PRC → REFD_TO_BE_REIM → REFD_REIMED`; the reimbursed
amount lands on your wallet, reported by `refundReimburse/check` + `ReimbursedResultNotify`.

Notable: `B134` already requested · `B146` order not refundable (not an issued/change order) ·
`B149` refundPricingId expired · `B153` duplicate refund.

> **TravelHub mapping:** the customer refund still runs immediately through Paymob per policy; the
> PKFare-side reimbursement is recorded as a **pending supplier-refund ledger entry** settled when
> the refund reaches `REFD_REIMED`. See
> [duffel-coupling-and-gaps.md](./duffel-coupling-and-gaps.md#gap-5--refund-is-async-and-multi-state).

---

## 10. TicketIssuanceNotify_V2 — push webhook (PKFare → us)

PKFare POSTs to a **buyer-hosted URL** when tickets issue/reject. Full field table in
[api-reference.md §6](./api-reference.md#ticketissuancenotify_v2-push--buyer-hosts-the-url).
Handler essentials — dedupe on `orderNum`+`status`, then:

```json
{
  "orderNum": "916716911545376001",
  "status": "ISSUED",
  "informType": "Ticket_Issued",
  "airPnr": "15CUCZ", "pnr": "187UIJ…",
  "paymentGate": "PREPAY",
  "permitVoid": 0,
  "passengers": [ { "passengerIndex": 1, "ticketNum": "1T9LO2/3T9LO2", "psgType": "ADT",
                    "firstName": "Wei", "lastName": "Chen" } ],
  "pnrList": [ /* per-segment PNRs */ ]
}
```
- `status: ISSUED` ⇒ advance booking `paid → confirmed`, write ticket-number `Document` rows.
- `status: REJECTED` ⇒ `paid → order_failed` + refund (reason in `rejectReason`/`remark`).
- `TODO(pkfare-verify)`: inbound auth scheme — until confirmed, gate by source-IP allowlist +
  `orderNum` must match a known booking.

---

## 11. Sandbox helper — `POST /json/buyer/fake/modifyOrder`

Test-only endpoint to **force an order-status transition** in sandbox (e.g. drive `TO_BE_PAID` →
`ISSED`) so you can exercise the confirmation path without a live airline issuance. Use it in the
smoke test ([switch-runbook.md](./switch-runbook.md)).

---

## Appendix — booking-flow timing & sequencing rules (verified)

| Rule | Source endpoint note |
|---|---|
| `preciseBooking` within **30 min** of `precisePricing` | PreciseBooking §Function / `B005` |
| `orderPricing` is **mandatory** before `ticketing` | OrderPricing §Function |
| `ticketing` within **30 min** of `orderPricing` | OrderPricing §Function |
| `cancel` only when status = `TO_BE_PAID` | Cancel `B009` |
| `B006`/`B028`/`B012` on booking ⇒ order may exist — reconcile, never blind-retry | PreciseBooking errors |
| `B022` on ticketing ⇒ wallet underfunded | Ticketing errors |
