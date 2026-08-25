import { expect, test } from "@playwright/test";
import { isoDaysFromToday, mockApi } from "./api-mock";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("the landing page renders the search card", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("ابحث عن رحلتك")).toBeVisible();
  await expect(page.getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
  await expect(page.getByRole("button", { name: /بحث/ })).toBeVisible();
});

test("searching carries the form state into the results URL", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /^search بحث$/ }).click();

  await page.waitForURL(/\/flights\?/);
  const params = new URL(page.url()).searchParams;
  // The homepage opens prefilled: Riyadh → Cairo, tomorrow, back in a week.
  expect(params.get("origin")).toBe("RUH");
  expect(params.get("destination")).toBe("CAI");
  expect(params.get("date")).toBe(isoDaysFromToday(1));
  expect(params.get("return_date")).toBe(isoDaysFromToday(8));
  expect(params.get("adults")).toBe("1");
  expect(params.get("cabin")).toBe("economy");
});

test("swapping the airports rewrites both fields", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "تبديل المغادرة والوصول" }).click();

  await expect(page.getByPlaceholder("اختر مطار المغادرة")).toHaveValue("القاهرة (CAI)");
  await expect(page.getByPlaceholder("اختر مطار الوصول")).toHaveValue("الرياض (RUH)");
});

test("a destination tile fills the search card", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /دبي/ }).first().click();

  await expect(page.getByPlaceholder("اختر مطار الوصول")).toHaveValue("دبي (DXB)");
});

test("the airport autocomplete suggests airports as you type", async ({ page }) => {
  await page.goto("/");

  const origin = page.getByPlaceholder("اختر مطار المغادرة");
  await origin.click();
  await origin.fill("jed");

  // Scoped by the code in brackets: the destination tiles below the fold
  // carry the same city name.
  await page.getByRole("button", { name: /\(JED\)/ }).click();

  await expect(origin).toHaveValue("جدة (JED)");
});
