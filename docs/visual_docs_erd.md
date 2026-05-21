# 📊 Visual System Documentation & Database ERD

This document provides a highly visual, interactive, and comprehensive breakdown of the **TravelHub B2B Platform** database schema (Entity Relationship Diagram) and core visual data flow architectures.

---

## 🗄️ 1. Entity Relationship Diagram (ERD)

The database schema is built on **PostgreSQL** and orchestrated using **Prisma**. Below is the complete interactive ERD illustrating all tables, fields, data types, and structural relationships (1-to-1, 1-to-many, nullable connections):

```mermaid
erDiagram
    COMPANIES ||--o{ USERS : "has"
    COMPANIES ||--|| WALLETS : "has"
    COMPANIES ||--o{ BOOKINGS : "places"
    COMPANIES ||--o{ INVOICES : "receives"
    COMPANIES ||--o{ MARKUP_RULES : "configures"

    USERS ||--o{ BOOKINGS : "manages"
    USERS ||--o{ AUDIT_LOGS : "triggers"

    WALLETS ||--o{ WALLET_TRANSACTIONS : "logs ledger"
    
    BOOKINGS ||--o{ PASSENGERS : "contains"
    BOOKINGS ||--|| INVOICES : "billing"
    BOOKINGS ||--o{ BOOKING_STATUS_LOGS : "logs history"
    BOOKINGS ||--o{ WALLET_TRANSACTIONS : "references financial"

    COMPANIES {
        uuid id PK
        varchar name "255"
        varchar nameAr "255, nullable"
        varchar licenseNumber "100, unique"
        varchar country "100"
        varchar city "100"
        text address "nullable"
        varchar phone "50"
        varchar email "255, unique"
        text logo "nullable"
        varchar website "255, nullable"
        enum status "PENDING, ACTIVE, SUSPENDED, REJECTED"
        decimal markupPercentage "5,2"
        varchar contactPersonName "nullable"
        varchar contactPersonPhone "nullable"
        text notes "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    USERS {
        uuid id PK
        uuid companyId FK "cascade, nullable"
        varchar email "255, unique"
        text passwordHash
        varchar fullName "255"
        varchar fullNameAr "255, nullable"
        varchar phone "50, nullable"
        enum role "SUPER_ADMIN, COMPANY_ADMIN, AGENT, FINANCE"
        boolean isActive
        boolean twoFactorEnabled
        text twoFactorSecret "nullable"
        timestamp lastLoginAt "nullable"
        varchar lastLoginIp "45, nullable"
        text refreshTokenHash "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    WALLETS {
        uuid id PK
        uuid companyId FK "unique, cascade"
        decimal balance "15,2"
        varchar currency "3"
        decimal creditLimit "15,2"
        boolean isActive
        int version "Optimistic Locking"
        timestamp createdAt
        timestamp updatedAt
    }

    WALLET_TRANSACTIONS {
        uuid id PK
        uuid walletId FK "cascade"
        uuid bookingId FK "setNull, nullable"
        enum type "DEPOSIT, BOOKING_DEBIT, REFUND_CREDIT, ADJUSTMENT, BONUS_CREDIT, WITHDRAWAL"
        decimal amount "15,2"
        decimal balanceBefore "15,2"
        decimal balanceAfter "15,2"
        varchar currency "3"
        varchar reference "255, nullable"
        text description "nullable"
        varchar idempotencyKey "255, unique"
        json metadata "nullable"
        timestamp createdAt
    }

    DEPOSIT_REQUESTS {
        uuid id PK
        uuid companyId FK
        decimal amount "15,2"
        decimal bonusAmount "15,2"
        varchar currency "3"
        enum paymentMethod "BANK_TRANSFER, CREDIT_CARD, ADMIN_ADJUSTMENT"
        varchar reference "255, nullable"
        text proofUrl "nullable"
        enum status "PENDING, APPROVED, REJECTED"
        uuid approvedBy "nullable"
        timestamp approvedAt "nullable"
        text rejectedReason "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    BOOKINGS {
        uuid id PK
        uuid companyId FK
        uuid userId FK
        enum type "FLIGHT, HOTEL"
        enum status "PENDING, CONFIRMED, TICKETED, CANCELLED, REFUND_PENDING, REFUNDED, FAILED, EXPIRED"
        varchar pkfareOrderId "255, nullable"
        varchar pnr "50, nullable"
        json searchParams "nullable"
        json pkfareResponse "nullable"
        decimal supplierPrice "15,2"
        decimal markupAmount "15,2"
        decimal totalAmount "15,2"
        varchar currency "3"
        varchar contactEmail "255, nullable"
        varchar contactPhone "50, nullable"
        text specialRequests "nullable"
        timestamp ticketDeadline "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    PASSENGERS {
        uuid id PK
        uuid bookingId FK "cascade"
        enum type "ADULT, CHILD, INFANT"
        varchar title "10, nullable"
        varchar firstName "255"
        varchar lastName "255"
        date dateOfBirth
        varchar nationality "3"
        varchar passportNumber "50, nullable"
        date passportExpiry "nullable"
        varchar passportCountry "3, nullable"
        varchar ticketNumber "50, nullable"
        varchar seatPreference "50, nullable"
        varchar mealPreference "50, nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    INVOICES {
        uuid id PK
        uuid bookingId FK "unique, cascade"
        uuid companyId FK
        varchar invoiceNumber "50, unique"
        decimal subtotal "15,2"
        decimal tax "15,2"
        decimal total "15,2"
        varchar currency "3"
        text pdfUrl "nullable"
        timestamp issuedAt
        timestamp createdAt
    }

    BOOKING_STATUS_LOGS {
        uuid id PK
        uuid bookingId FK "cascade"
        enum fromStatus "nullable"
        enum toStatus
        text note "nullable"
        uuid changedBy "nullable"
        timestamp createdAt
    }

    MARKUP_RULES {
        uuid id PK
        uuid companyId FK "cascade, nullable"
        enum serviceType "FLIGHT, HOTEL"
        enum markupType "PERCENTAGE, FIXED"
        decimal markupValue "10,2"
        decimal minMarkup "10,2, nullable"
        decimal maxMarkup "10,2, nullable"
        boolean isActive
        timestamp createdAt
        timestamp updatedAt
    }

    AUDIT_LOGS {
        uuid id PK
        uuid userId FK "setNull, nullable"
        varchar action "100"
        varchar entity "100"
        uuid entityId "nullable"
        json changes "nullable"
        varchar ipAddress "45, nullable"
        text userAgent "nullable"
        timestamp createdAt
    }
```

---

## 🔄 2. Core Visual System Data Flows

### A. Dynamic Search Cache & Upstream Dispatcher
This flow maps out how search requests utilize **Redis caching** to save latency times before performing full PKFARE upstream GZIP downloads:

```mermaid
graph TD
    A[Frontend Search Form] -->|1. Submit parameters| B(NestJS API Endpoint)
    B -->|2. Check cache| C{Redis Cache Hit?}
    
    C -->|Yes, < 5 min old| D[3a. Return cached flight solutions]
    D -->|Instantly| A
    
    C -->|No| E[3b. Invoke FlightSearchService]
    E -->|4. Generate dynamic signatures| F(PkfareAuthService)
    E -->|5. Base64 wrap JSON parameters| G(PkfareHttpService)
    G -->|6. POST plain text payload| H[PKFARE GZIP Gateway]
    H -->|7. Return binary GZIP buffer| G
    G -->|8. zlib decompress to standard JSON| E
    E -->|9. Write solutions to cache| B
    B -->|10. Return fresh flight solutions| A
```

---

## 💰 3. B2B Wallet Ledgering Lifecycle (Optimistic Locking Protection)

To prevent double-spending in concurrency scenarios (e.g. multiple agents in the same company attempting to purchase different seats simultaneously), the platform uses **Optimistic Locking** on the Wallet entity:

```mermaid
flowchart TD
    Start([1. Agent Clicks Buy]) --> LoadWallet[2. Load Wallet: balance, creditLimit, version]
    LoadWallet --> Calc[3. Check if balance + creditLimit >= requiredAmount]
    
    Calc -->|Insufficient Credit| ThrowError([Throw BadRequestException: Insufficient Wallet Credit])
    
    Calc -->|Sufficient Credit| DbTx[4. Begin DB Transaction]
    DbTx --> Debit[5. Execute Wallet Update: balance = balance - requiredAmount, version = version + 1 WHERE version = originalVersion]
    
    Debit --> CheckRows{6. Were rows updated?}
    
    CheckRows -->|No: Concurrency conflict| Rollback[7a. Rollback Transaction]
    Rollback --> Retry[7b. Retry transaction after brief random sleep]
    Retry --> LoadWallet
    
    CheckRows -->|Yes: Balance updated safely| Ledger[8. Write WalletTransaction ledger entry]
    Ledger --> APIUpstream[9. Execute remote PKFARE Book & Issuance]
    
    APIUpstream --> UpstreamCheck{10. Did Upstream Succeed?}
    
    UpstreamCheck -->|Yes| Commit[11a. Commit Transaction: status = TICKETED]
    Commit --> EndSuccess([Done: Ticket Issued])
    
    UpstreamCheck -->|No: Ticketing Failed| Refund[11b. Execute Wallet Refund: balance = balance + requiredAmount]
    Refund --> LedgerRefund[12. Write WalletTransaction Refund entry]
    LedgerRefund --> FailCommit[13. Commit status = FAILED]
    FailCommit --> EndFail([Failed: Money safely refunded])
```

---

> [!TIP]
> **Optimistic locking version checks** completely prevent race conditions during high-volume periods without incurring heavy database row-level locking performance penalties.
