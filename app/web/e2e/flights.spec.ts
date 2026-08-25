import { expect, test } from "@playwright/test";
import { mockApi, SAMPLE_OFFER } from "./api-mock";

const SEARCH_URL = "/flights?origin=RUH&destination=CAI&date=2026-09-10&adults=1&cabin=economy";

test("renders an offer returned by the search API", async ({ page }) => {
  await mockApi(page, { offers: [SAMPLE_OFFER] });

  await page.goto(SEARCH_URL);

  await expect(page.getByText("Duffel Airways").first()).toBeVisible();
  await expect(page.getByText(/24,544\.00/).first()).toBeVisible();
});

test("maps the URL query onto the API contract", async ({ page }) => {
  await mockApi(page, { offers: [SAMPLE_OFFER] });
  const searchRequest = page.waitForRequest((req) => req.url().includes("/flights/search"));

  await page.goto(SEARCH_URL);

  const params = new URL((await searchRequest).url()).searchParams;
  expect(params.get("origin")).toBe("RUH");
  expect(params.get("destination")).toBe("CAI");
  // The page renames the query params to the ones the backend expects.
  expect(params.get("departure_date")).toBe("2026-09-10");
  expect(params.get("cabin_class")).toBe("economy");
  expect(params.get("adults")).toBe("1");
});

test("shows the empty state when the supplier has nothing", async ({ page }) => {
  await mockApi(page, { offers: [] });

  await page.goto(SEARCH_URL);

  await expect(page.getByText("لا توجد رحلات مطابقة لبحثك")).toBeVisible();
});

test("shows a retryable error when the search fails", async ({ page }) => {
  await mockApi(page, { searchFails: true });

  await page.goto(SEARCH_URL);

  await expect(page.getByRole("button", { name: "إعادة المحاولة" })).toBeVisible();
});
