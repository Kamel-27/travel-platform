import { describe, expect, it } from "vitest";
import { decimalsForCurrency, formatMoney, toMajorUnits } from "./money";

// ICU puts a non-breaking space between the currency code and the amount for
// codes it renders as text (EGP, KWD). Compare on normalized whitespace so the
// assertions don't depend on the runner's ICU build.
const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("decimalsForCurrency", () => {
  it("defaults to 2 decimals for ordinary currencies", () => {
    expect(decimalsForCurrency("USD")).toBe(2);
    expect(decimalsForCurrency("EGP")).toBe(2);
  });

  it("knows the 0-decimal currencies", () => {
    expect(decimalsForCurrency("JPY")).toBe(0);
    expect(decimalsForCurrency("KRW")).toBe(0);
    expect(decimalsForCurrency("HUF")).toBe(0);
  });

  it("knows the 3-decimal currencies", () => {
    for (const code of ["KWD", "BHD", "OMR", "JOD", "LYD"]) {
      expect(decimalsForCurrency(code)).toBe(3);
    }
  });

  it("is case-insensitive", () => {
    expect(decimalsForCurrency("jpy")).toBe(0);
    expect(decimalsForCurrency("kwd")).toBe(3);
  });
});

describe("toMajorUnits", () => {
  it("shifts by the currency's own decimal count, not a hardcoded 2", () => {
    expect(toMajorUnits(154200, "USD")).toBe(1542);
    expect(toMajorUnits(1234500, "JPY")).toBe(1234500);
    expect(toMajorUnits(1234, "KWD")).toBe(1.234);
  });
});

describe("formatMoney", () => {
  it("formats a 2-decimal currency", () => {
    expect(norm(formatMoney(154200, "USD"))).toBe("$1,542.00");
  });

  it("formats a 0-decimal currency without inventing cents", () => {
    expect(norm(formatMoney(1234500, "JPY"))).toBe("¥1,234,500");
  });

  it("formats a 3-decimal currency", () => {
    expect(norm(formatMoney(1234, "KWD"))).toBe("KWD 1.234");
  });

  it("renders the real EGP total of a booking", () => {
    expect(norm(formatMoney(2454400, "EGP"))).toBe("EGP 24,544.00");
  });

  it("uppercases the ISO code before handing it to Intl", () => {
    expect(norm(formatMoney(154200, "usd"))).toBe("$1,542.00");
  });

  it("honours a non-default locale", () => {
    expect(norm(formatMoney(154200, "USD", "de-DE"))).toBe("1.542,00 $");
  });

  it("falls back to a plain number and code when Intl rejects the currency", () => {
    expect(norm(formatMoney(1000, "XX"))).toBe("10.00 XX");
  });

  it("keeps the right decimals in the fallback path", () => {
    expect(norm(formatMoney(1000, "X"))).toBe("10.00 X");
  });
});
