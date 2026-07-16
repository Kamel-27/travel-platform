# PKFare Flight Buyer API — Verified Reference

All facts below are **verified against the official PKFARE Flight Buyer API docs**
(`https://apifox.pkfare.com/apidoc/project-345083`, read July 2026). Anything not confirmable
from the public docs is marked `TODO(pkfare-verify)`.

---

## 1. Transport

- **Base URL:** `https://api.pkfare.com`
- **Every flight endpoint:** `POST https://api.pkfare.com/json/<name>`
- **Content type:** `application/json` — **plain JSON**, request and response.
- **Request envelope:** a top-level `authentication` object plus one named payload object:

  ```json
  {
    "authentication": { "partnerId": "<id>", "sign": "<md5>" },
    "search": { "...": "..." }
  }
  ```

- **Response envelope:** every response is
  `{ "errorCode": "0", "errorMsg": "ok", "data": { ... } }`. `errorCode === "0"` means success;
  `data` is only populated on success. Errors are carried **in-body**, not via HTTP status.
- **Compression:** the response may be gzip-compressed **only if** you send
  `Accept-Encoding: gzip` (standard HTTP). It is optional.

> ❌ **Correction to old repo code:** PKFare does **not** use a base64-encoded request envelope
> and does **not** mandate gzip. The deleted `app/api/src/pkfare/pkfare-http.service.ts`
> (base64 body + unconditional `zlib.gunzipSync`) was wrong.

### Documented error codes (Shopping)

| Code | Meaning |
|---|---|
| `0` | OK — processed successfully |
| `S001` | System error |
| `B002` | Partner does not exist (bad `partnerId`) |
| `B003` | **Illegal sign** — signature check failed |
| `P001` / `P002` | Field `XXX` is illegal / missing |
| `P004` | Max 9 passengers with seat |
| `P005` | At least one adult required |
| `P009` | Infants cannot exceed adults |
| `B024` | **Time-out** — retry after a few seconds |
| `B035` | **Concurrency limited** — contact PKFare support |
| `B039` | Can't find data for `XXX` (illegal city/country/airline) |
| `B059` / `B009` | Upstream shopping failure / supplier offline |

`B024` (timeout) is the **ambiguous / retryable** class; `P0xx` are definitive validation
failures. This maps directly onto the existing `ProviderDefinitiveError` vs
`ProviderAmbiguousError` split.

---

## 2. Authentication (verified)

```
sign = MD5(partnerId + partnerKey)     // lowercase hex, STATIC (no timestamp, no nonce)
```

`partnerId` and `partnerKey` come from your PKFare account manager. The sign is a constant for
your credentials — compute once and cache. PKFare's own Postman example:

```js
const sign = CryptoJS.MD5(partnerId + partnerKey).toString();
```

> ❌ **Correction:** the old repo used `MD5(partnerId + timestamp + apiKey)`. The real sign has
> **no timestamp**.

---

## 3. Endpoints and booking flow

All under `/json/…`. Names include a version suffix (use the latest shown in the docs).

```
shoppingV9          search flights → solutions[] (each has an opaque solutionId)
     │
precisePricing_V11  re-price a chosen solutionId (fresh price + availability)
     │
penaltyV3           (optional) full structured fare-rule / penalty detail
     │
preciseBooking_V7   create the order → orderNum, status = TO_BE_PAID
     │
orderPricingV5      final price confirmation before paying
     │
ticketing           pay from prepaid wallet + issue tickets → status = ISS_PRC
requestTicketing    (variant: request issuance)
     │
orderDetail/v13     poll order status, PNR, ticket numbers
     │
cancel              cancel order (pre-ticketing)
```

Additional documented API families (categories in the apidoc):

- **Ancillary booking APIs** — paid bags/seats.
- **Flight schedule change APIs** — airline-initiated changes.
- **Refund APIs** — post-ticketing refunds (async).
- **Change APIs** / **Void APIs** — reissue and void.
- **Cache APIs** — cached shopping content.
- `TicketIssuanceNotify_V2` — **push webhook** (see §6).
- `buyer/fake/modifyOrder` — **sandbox helper** to force order-status transitions during testing.

---

## 4. Search response model (`shoppingV9`)

Request body highlights (`search` object): `adults`, `children`, `infants`, `nonstop`,
`airline`, `solutions` (suggested count), `tag`/`returnTagPrice` (branded/product fares), and
`searchAirLegs[]` — each leg `{ cabinClass, departureDate, origin, destination, airline }`
(max 2 legs).

Response `data` is a **reference graph**, not a nested tree:

```
data
├─ searchKey        // unique id for this search
├─ shoppingKey      // unique id for this shopping session
├─ solutions[]      // priced itineraries
├─ flights[]        // referenced by solutions.journeys
└─ segments[]       // referenced by flights
```

A **solution** carries:

| Field | Meaning |
|---|---|
| `solutionId` | **Opaque encrypted token** — echo this into pricing/booking. NOT a short id. |
| `solutionKey` | Secondary key |
| `fareType` | `PUBLISHED` or `PRIVATE` (wholesale/negotiated) |
| `currency` | Fare currency (e.g. `USD`) |
| `adtFare`,`adtTax`,`chdFare`,`chdTax` | **Per-pax-type decimal** base fare + tax |
| `qCharge`,`tktFee`,`platformServiceFee`,`merchantFee` | Additional fee components |
| `platingCarrier` | Validating/plating carrier (IATA) |
| `journeys` | `{ "journey_0": [flightId,…], "journey_1": […] }` → refs into `flights[]` |
| `baggageMap` | Per pax type: checked/carry-on allowance per segment index |
| `miniRuleMap` | Structured fare rules (see below) |

**`miniRuleMap`** entries (per pax type, per segment set): `penaltyType` (**0 = refund,
1 = change**), `isPermited` (0/1), `when` (before/after departure tier), `amount`, `percent`,
`currencyCode`, `baseType`. This is what maps to TravelHub's
`conditions.refund_before_departure` / `change_before_departure`.

**Mapper note:** to build one `NormalizedOffer`, join
`solution → journeys → flights[] → segments[]`, sum `adtFare+adtTax` (× pax) etc. into `total`,
and convert decimals to minor units in the adapter.

---

## 5. Passenger model (booking + notify)

| Field | Meaning |
|---|---|
| `passengerIndex` | 1-based sequence; stable across the booking |
| `firstName`, `lastName` | Given / family name |
| `birthday` | `yyyy-mm-dd` |
| `psgType` | `ADT` (adult) / `CHD` (child 2–12) / `INF` (infant 0–2, no seat) |
| `sex` | `M` / `F` |
| `cardType` | `P` passport / `N` Chinese ID / `O` other |
| `cardNum` | Travel-document number |
| `cardExpiredDate` | `yyyy-mm-dd` |
| `nationality` | Country code |
| `associatedPassengerIndex` | Infant → responsible-adult `passengerIndex` (infants only) |
| `ticketNum` | Ticket number(s) once issued (`/`-separated for multi-segment) |

Maps cleanly from the existing `Passenger` entity (given/family name, DOB, gender, doc fields,
`responsibleAdultPassengerId` → `associatedPassengerIndex`).

---

## 6. Async ticketing: push webhook **and** poll

Ticketing is **not synchronous**. `preciseBooking` reaches `TO_BE_PAID`; `ticketing` moves it to
`ISS_PRC` (issuing). Confirmation (`ISSED` + ticket numbers) arrives via **two** channels:

### `TicketIssuanceNotify_V2` (push — buyer hosts the URL)

You provide an HTTP(S) URL to PKFare; PKFare **POSTs** to it when tickets issue (or a rejection).
Latest version is `TicketIssuanceNotify_V2` (adds ticketing-failure reasons; V3 adds a richer
PNR list). Payload fields:

| Field | Meaning |
|---|---|
| `orderNum` | PKFare order number |
| `status` | `ISSUED` / `CHANGED` / `REJECTED` |
| `informType` | `Ticket_Issued` / `Ticket_Reissued` / `Ticket_Change` |
| `rejectReason` / `remark` | Reason if `REJECTED` |
| `airPnr`, `pnr`, `pnrList[]` | Airline PNR / GDS PNR / per-segment PNR list |
| `passengers[]` | Each with `passengerIndex` + `ticketNum` |
| `paymentGate` | e.g. `PREPAY` (prepaid wallet) |
| `permitVoid`, `lastVoidTime`, `voidServiceFee`, `currency` | Void eligibility window |

> `TODO(pkfare-verify)`: the **inbound authentication** for this callback (IP allowlist vs shared
> token vs a sign field) is not stated in the public apidoc — confirm with the account manager.
> Until confirmed, gate the endpoint by source-IP allowlist **and** require the `orderNum` to
> match a known booking before mutating state.

### `orderDetail/v13` (poll — backstop)

Poll for the authoritative order status, PNR, and ticket numbers. This is the reconciliation
safety net if the push is missed or arrives before the order is linked locally — exactly the
role Duffel's list-orders reconciliation plays today.

---

## 7. Order-status lifecycle (verified enum)

| Status | Meaning | Final? | TravelHub mapping |
|---|---|---|---|
| `TO_BE_PAID` | Order created, awaiting payment | no | `paid` (awaiting fulfillment) |
| `ISS_PRC` | Ticket issuing in progress | no | `paid` (fulfilling) |
| **`ISSED`** | **Ticket issued** | **yes** | **`confirmed`** (+ documents) |
| `RSV_FAIL` | Reservation failed | yes | `order_failed` + refund |
| `TO_BE_RSV` | To be reserved | no | `paid` |
| `UNDER_REVIEW` | Manual review | no | `paid` (watch) |
| `HOLD` | Held manually — contact CS | no | admin attention |
| `CNCL` | Cancelled | yes | `cancelled` |
| `CNCL_TO_BE_REIM` / `CNCL_REIMED` | Cancelled, reimbursement pending / done | no / yes | `order_failed`/`cancelled` + refund |
| `CHG_RQ`→`CHG_TO_BE_PAID`→`CHG_PRC`→`CHGD` | Change flow | … / `CHGD` yes | schedule/change handling |
| `REFD_PRC`→`REFD_TO_BE_REIM`→`REFD_REIMED` | Refund flow | `REFD_REIMED` yes | refund pipeline |
| `REFD_REJ` / `CHG_REJ` / `VOID_REJ` | Rejected | yes | surface to admin |
| `VOID_*` | Void flow | `VOID` no / `VOID_REIMED` yes | void handling |

**Documented scenario transitions:**

- Issued success: `TO_BE_PAID → ISS_PRC → ISSED`
- PNR cancelling: `TO_BE_PAID → CNCL`
- Issued failed: `TO_BE_PAID → ISS_PRC → CNCL_TO_BE_REIM → CNCL_REIMED` (PKFare auto-reimburses
  your wallet)
- Refund success: `UNDER_REVIEW → REFD_PRC → REFD_TO_BE_REIM → REFD_REIMED`
- Change success: `CHG_RQ → UNDER_REVIEW → CHG_TO_BE_PAID → CHG_PRC → CHGD`

The two that matter for the critical path: **`ISSED` → `confirmed`**, and any
**`RSV_FAIL` / `CNCL_*`** terminal → **`order_failed` + customer refund**.

---

## 8. Still open (`TODO(pkfare-verify)`)

Needs credentials or the account manager — none of these block the abstraction refactor:

- Exact request schemas for `preciseBooking_V7` and `ticketing` (field names for the create-order
  and issuance payloads).
- `TicketIssuanceNotify_V2` inbound auth scheme (§6).
- Prepaid-wallet / insufficient-balance error codes.
- Sandbox base URL + a live end-to-end smoke test.
