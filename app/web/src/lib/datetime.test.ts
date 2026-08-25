import { describe, expect, it } from "vitest";
import {
  formatFlightDate,
  formatFlightDateTime,
  formatFlightTime,
  formatIsoDuration,
  formatSystemTimestamp,
  parseIsoDurationMinutes,
} from "./datetime";

const norm = (s: string) => s.replace(/[  ]/g, " ");

// The suite runs with TZ=America/Los_Angeles (vitest.setup.ts). Any
// implementation that routed these strings through UTC would shift the hour
// (and roll the date near midnight) — that's what these assertions catch.
describe("formatFlightTime", () => {
  it("renders a morning departure as 12-hour local wall-clock", () => {
    expect(formatFlightTime("2026-08-01T09:15:00")).toBe("9:15 AM");
  });

  it("renders midnight as 12 AM, not 0 AM", () => {
    expect(formatFlightTime("2026-08-01T00:05:00")).toBe("12:05 AM");
  });

  it("renders noon as 12 PM, not 0 PM", () => {
    expect(formatFlightTime("2026-08-01T12:00:00")).toBe("12:00 PM");
  });

  it("renders a late-evening departure without shifting it", () => {
    expect(formatFlightTime("2026-08-01T23:45:00")).toBe("11:45 PM");
  });

  it("pads single-digit minutes", () => {
    expect(formatFlightTime("2026-08-01T07:05:00")).toBe("7:05 AM");
  });

  it("tolerates a trailing offset or seconds it doesn't need", () => {
    expect(formatFlightTime("2026-08-01T09:15:30")).toBe("9:15 AM");
  });

  it("throws on an unparseable format rather than rendering a wrong time", () => {
    expect(() => formatFlightTime("01/08/2026 09:15")).toThrow(/Unrecognized local time format/);
  });
});

describe("formatFlightDate", () => {
  it("formats the wall-clock date", () => {
    expect(formatFlightDate("2026-08-01T09:15:00")).toBe("Aug 1, 2026");
  });

  it("does not roll the date forward for a near-midnight departure", () => {
    // UTC-normalizing this under TZ=America/Los_Angeles would give Aug 2.
    expect(formatFlightDate("2026-08-01T23:45:00")).toBe("Aug 1, 2026");
  });

  it("does not roll the date backward for a just-after-midnight departure", () => {
    expect(formatFlightDate("2026-01-15T00:30:00")).toBe("Jan 15, 2026");
  });

  it("maps every month index to the right name", () => {
    expect(formatFlightDate("2026-01-05T10:00:00")).toBe("Jan 5, 2026");
    expect(formatFlightDate("2026-12-31T10:00:00")).toBe("Dec 31, 2026");
  });
});

describe("formatFlightDateTime", () => {
  it("joins date and time with the separator the UI expects", () => {
    expect(formatFlightDateTime("2026-08-01T23:45:00")).toBe("Aug 1, 2026 · 11:45 PM");
  });
});

describe("parseIsoDurationMinutes", () => {
  it("parses hours and minutes", () => {
    expect(parseIsoDurationMinutes("PT3H25M")).toBe(205);
  });

  it("parses an hours-only duration", () => {
    expect(parseIsoDurationMinutes("PT2H")).toBe(120);
  });

  it("parses a minutes-only duration", () => {
    expect(parseIsoDurationMinutes("PT45M")).toBe(45);
  });

  it("returns 0 for null, undefined and empty input", () => {
    expect(parseIsoDurationMinutes(null)).toBe(0);
    expect(parseIsoDurationMinutes(undefined)).toBe(0);
    expect(parseIsoDurationMinutes("")).toBe(0);
  });

  it("returns 0 for a string it can't parse", () => {
    expect(parseIsoDurationMinutes("3h25m")).toBe(0);
  });
});

describe("formatIsoDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatIsoDuration("PT3H25M")).toBe("3h 25m");
  });

  it("omits the empty half", () => {
    expect(formatIsoDuration("PT2H")).toBe("2h");
    expect(formatIsoDuration("PT45M")).toBe("45m");
  });

  it("renders a zero-length duration as 0m rather than an empty string", () => {
    expect(formatIsoDuration("PT")).toBe("0m");
  });

  it("returns an empty string for missing input", () => {
    expect(formatIsoDuration(null)).toBe("");
    expect(formatIsoDuration(undefined)).toBe("");
  });

  it("passes an unrecognised string through untouched", () => {
    expect(formatIsoDuration("3h25m")).toBe("3h25m");
  });
});

describe("formatSystemTimestamp", () => {
  it("converts a UTC timestamp into the viewer's local time", () => {
    // 2026-08-01T06:45Z is 2026-07-31 23:45 in America/Los_Angeles.
    expect(norm(formatSystemTimestamp("2026-08-01T06:45:00.000Z"))).toBe("Jul 31, 2026, 11:45 PM");
  });
});
