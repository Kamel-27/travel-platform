# Implementation Plan - Backend Removal & Amadeus API Frontend Integration

We will remove the old NestJS backend / API module completely to clean up the codebase. Since Next.js has built-in server-side API Route Handlers, we can securely integrate the **Amadeus API** directly inside the Next.js frontend application (`app/web`). This keeps API keys hidden from the client side, eliminates the complex NestJS infrastructure (PostgreSQL, Prisma, Redis, MinIO), and makes the frontend fully functional!

---

## User Review Required

> [!IMPORTANT]
> **API Credentials**: You will need to sign up for an [Amadeus Self-Service Developer Account](https://developers.amadeus.com/) (free tier available) and add the following keys to your frontend `.env.local` or environment config:
> - `AMADEUS_CLIENT_ID`
> - `AMADEUS_CLIENT_SECRET`

---

## Proposed Changes

### [Backend Removal]
We will delete the old NestJS API codebase completely as it is no longer needed.

#### [DELETE] [app/api](file:///c:/Users/kamel/Documents/GitHub/travel-platform/app/api)
- Deletes the entire NestJS project folder (`app/api`), including its Nest cli configuration, ESLint configuration, Prisma database schemas, and all PKFARE adapter services.

---

### [Next.js Server-Side Integration (Secure Amadeus Gateway)]
We will build a server-side client inside `app/web` that fetches OAuth2 access tokens and makes requests to the Amadeus test API.

#### [NEW] [amadeus.ts](file:///c:/Users/kamel/Documents/GitHub/travel-platform/app/web/src/lib/amadeus.ts)
- A server-only helper utility that handles:
  1. Obtaining and caching the OAuth2 Bearer Access Token.
  2. Direct API call routing with built-in headers and parameters formatting.
  3. High reliability through standard error extraction.

#### [NEW] [route.ts (flights)](file:///c:/Users/kamel/Documents/GitHub/travel-platform/app/web/src/app/api/flights/route.ts)
- Next.js API Route Handler that:
  1. Reads query parameters (`origin`, `destination`, `date`, `adults`).
  2. Queries the Amadeus `GET /v2/shopping/flight-offers` endpoint.
  3. Formats the massive Amadeus JSON solution catalogs into the structured UI data format used by our flights page.

#### [NEW] [route.ts (hotels)](file:///c:/Users/kamel/Documents/GitHub/travel-platform/app/web/src/app/api/hotels/route.ts)
- Next.js API Route Handler that:
  1. Reads query parameters (`cityCode`, `checkIn`, `checkOut`, `adults`).
  2. Resolves hotels in the destination city using `GET /v1/reference-data/locations/hotels/by-city`.
  3. Obtains prices and room categories using `GET /v3/shopping/hotel-offers`.
  4. Returns mapped hotel packages fitting our frontend hotels page cards.

---

### [Next.js Frontend Enhancements]
We will modify the frontend search pages to dynamically query our local API routes instead of relying entirely on static mock data.

#### [MODIFY] [page.tsx (flights)](file:///c:/Users/kamel/Documents/GitHub/travel-platform/app/web/src/app/flights/page.tsx)
- Replaces static flight lists with dynamic state.
- Automatically initiates a search based on URL query parameters.
- Triggers a loading skeleton during active requests.
- Renders the flight cards dynamically using real Amadeus offers.

#### [MODIFY] [page.tsx (hotels)](file:///c:/Users/kamel/Documents/GitHub/travel-platform/app/web/src/app/hotels/page.tsx)
- Replaces local mock arrays with state populated by the `/api/hotels` route.
- Synchronizes search dropdown choices with the active API parameters.
- Re-executes hotel shopping queries when the user modifies search fields or clicks "Search".

---

## Verification Plan

### Automated / Route Verification
We will run and verify the Next.js development server:
```bash
# Navigate to web app
cd app/web

# Install dependencies and start local dev server
npm install
npm run dev
```
1. **API Sandbox Tests**: Test API routes directly via the browser or API client (e.g. Insomnia/Postman):
   - `http://localhost:3000/api/flights?origin=RUH&destination=DXB&date=2026-10-15`
   - `http://localhost:3000/api/hotels?cityCode=DXB&checkIn=2026-12-15&checkOut=2026-12-20`
2. **Page Flow Verification**: Perform visual validation of the flights search page and hotels search page inside the browser.
