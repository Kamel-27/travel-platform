import type { Page, Route } from "@playwright/test";

export const CUSTOMER_SESSION = {
  access_token: "e2e-access-token",
  expires_in: 900,
  user: {
    id: "u_e2e",
    email: "traveller@example.com",
    full_name: "مسافر تجريبي",
    phone: null,
    role: "user",
  },
};

export const ADMIN_SESSION = {
  ...CUSTOMER_SESSION,
  user: { ...CUSTOMER_SESSION.user, id: "u_admin", role: "technical_admin" },
};

export const SAMPLE_OFFER = {
  offer_id: "off_e2e_1",
  expires_at: "2030-01-01T00:00:00.000Z",
  total: { amount: 2454400, currency: "EGP" },
  airline: { name: "Duffel Airways", iata: "ZZ", logo_url: "" },
  cabin_class: "economy",
  passenger_identity_documents_required: false,
  slices: [
    {
      origin: "RUH",
      destination: "CAI",
      duration: "PT3H25M",
      segments: [
        {
          marketing_carrier: "ZZ",
          operating_carrier: "ZZ",
          flight_number: "1234",
          departing_at: { local: "2026-09-10T09:15:00", timezone: "Asia/Riyadh" },
          arriving_at: { local: "2026-09-10T11:40:00", timezone: "Africa/Cairo" },
          origin_terminal: "1",
          destination_terminal: "2",
        },
      ],
    },
  ],
  conditions: {
    refund_before_departure: { allowed: true, penalty: { amount: 450000, currency: "EGP" } },
  },
  passengers: [{ id: "pas_1", type: "adult" }],
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function errorEnvelope(code: string, message: string) {
  return { error: { code, message, details: {} } };
}

interface MockOptions {
  /** Session returned by POST /auth/refresh. Omit for a signed-out visitor. */
  session?: typeof CUSTOMER_SESSION;
  /** Offers returned by GET /flights/search. */
  offers?: unknown[];
  /** Make the flight search fail instead of returning offers. */
  searchFails?: boolean;
}

/**
 * Intercepts the whole API surface. Playwright gives precedence to the most
 * recently registered route, so the catch-all is installed first and the
 * specific endpoints after it.
 */
export async function mockApi(page: Page, options: MockOptions = {}): Promise<void> {
  // Anything not spelled out below: an empty collection, which every list
  // screen renders as its own empty state rather than an error.
  await page.route("**/api/v1/**", (route) => json(route, 200, { data: [], next_cursor: null }));

  await page.route("**/api/v1/auth/refresh", (route) =>
    options.session
      ? json(route, 200, options.session)
      : json(route, 401, errorEnvelope("NO_SESSION", "لا توجد جلسة")),
  );

  await page.route("**/api/v1/flights/search*", (route) =>
    options.searchFails
      ? json(route, 502, errorEnvelope("SUPPLIER_ERROR", "تعذر جلب الرحلات من المزود"))
      : json(route, 200, { data: options.offers ?? [], next_cursor: null }),
  );
}

/** YYYY-MM-DD, `days` from today — matches the homepage's prefilled dates. */
export function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
