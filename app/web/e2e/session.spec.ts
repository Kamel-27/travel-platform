import { expect, test } from "@playwright/test";
import { ADMIN_SESSION, CUSTOMER_SESSION, mockApi } from "./api-mock";

test("a customer lands on their own dashboard from the legacy bookings URL", async ({ page }) => {
  await mockApi(page, { session: CUSTOMER_SESSION });

  await page.goto("/manage-bookings");

  await page.waitForURL("**/user-dashboard");
});

test("a technical admin lands on the admin booking queue instead", async ({ page }) => {
  await mockApi(page, { session: ADMIN_SESSION });

  await page.goto("/manage-bookings");

  await page.waitForURL("**/admin/bookings");
});

test("the header reflects a restored session", async ({ page }) => {
  await mockApi(page, { session: CUSTOMER_SESSION });

  await page.goto("/");

  // The access token is memory-only; this proves the refresh-cookie rehydration
  // runs on a cold load.
  await expect(page.getByRole("button", { name: "تسجيل الخروج" })).toBeVisible();
});

test("a signed-out visitor keeps the sign-in call to action", async ({ page }) => {
  await mockApi(page);

  await page.goto("/");

  await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
  await expect(page.getByRole("button", { name: "تسجيل الخروج" })).toHaveCount(0);
});
