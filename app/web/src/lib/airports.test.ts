import { describe, expect, it } from "vitest";
import { AIRPORTS, getAirportByCode, getAirportLabel, searchAirports } from "./airports";

const codesOf = (list: { code: string }[]) => list.map((a) => a.code);

describe("searchAirports", () => {
  it("shows the popular airports when the query is empty", () => {
    expect(codesOf(searchAirports(""))).toEqual(["RUH", "JED", "DXB", "DOH", "CAI", "IST", "LHR", "CDG"]);
  });

  it("treats a whitespace-only query as empty", () => {
    expect(codesOf(searchAirports("   "))).toEqual(codesOf(searchAirports("")));
  });

  it("matches on IATA code, case-insensitively", () => {
    expect(codesOf(searchAirports("dxb"))).toEqual(["DXB"]);
  });

  it("matches on the English city name", () => {
    expect(codesOf(searchAirports("Jeddah"))).toEqual(["JED"]);
  });

  it("matches on the Arabic city name", () => {
    expect(codesOf(searchAirports("جدة"))).toEqual(["JED"]);
  });

  it("matches on the English country name", () => {
    expect(codesOf(searchAirports("Saudi Arabia"))).toEqual(["RUH", "JED", "DMM", "MED"]);
  });

  it("matches on the Arabic country name", () => {
    expect(codesOf(searchAirports("الإمارات"))).toEqual(["DXB", "AUH", "SHJ"]);
  });

  it("caps results at 8 so the dropdown never overflows", () => {
    const results = searchAirports("a");
    expect(results.length).toBe(8);
  });

  it("returns nothing for a query that matches no airport", () => {
    expect(searchAirports("zzzzz")).toEqual([]);
  });
});

describe("getAirportByCode", () => {
  it("finds an airport by its exact code", () => {
    expect(getAirportByCode("DXB")?.city).toBe("Dubai");
  });

  it("uppercases the code before looking it up", () => {
    expect(getAirportByCode("dxb")?.code).toBe("DXB");
  });

  it("returns undefined for an unknown code", () => {
    expect(getAirportByCode("ZZZ")).toBeUndefined();
  });
});

describe("getAirportLabel", () => {
  it("renders the Arabic city plus the code", () => {
    expect(getAirportLabel("DXB")).toBe("دبي (DXB)");
  });

  it("falls back to the raw code when the airport isn't in the table", () => {
    // Duffel returns codes far beyond this static table — the label must
    // degrade to the code rather than render "undefined (XXX)".
    expect(getAirportLabel("ZZZ")).toBe("ZZZ");
  });
});

describe("the airport table itself", () => {
  it("has no duplicate codes", () => {
    const codes = codesOf(AIRPORTS);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("gives every entry an Arabic city and country label", () => {
    for (const airport of AIRPORTS) {
      expect(airport.cityAr, `${airport.code} is missing cityAr`).toBeTruthy();
      expect(airport.countryAr, `${airport.code} is missing countryAr`).toBeTruthy();
    }
  });
});
