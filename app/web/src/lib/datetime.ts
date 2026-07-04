// Flight times from the API are local wall-clock strings with no UTC
// offset ("2026-08-01T09:15:00") plus a separate IANA `timezone` field.
// Per docs/api_contract.md §0: "never UTC-normalize" — the hour shown must
// always be the airport's local hour, regardless of the viewer's browser
// timezone. `new Date(str)` is intentionally avoided here: browsers parse
// offset-less ISO strings as *browser-local* time, which would silently
// shift the displayed hour. Parse the components directly instead.
interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const WALL_CLOCK_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function parseWallClock(local: string): WallClock {
  const match = WALL_CLOCK_RE.exec(local);
  if (!match) {
    throw new Error(`Unrecognized local time format: ${local}`);
  }
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

export function formatFlightTime(local: string): string {
  const { hour, minute } = parseWallClock(local);
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatFlightDate(local: string): string {
  const { year, month, day } = parseWallClock(local);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export function formatFlightDateTime(local: string): string {
  return `${formatFlightDate(local)} · ${formatFlightTime(local)}`;
}

/** Parses an ISO 8601 duration like "PT3H25M" into total minutes (205). */
export function parseIsoDurationMinutes(duration: string | null | undefined): number {
  if (!duration) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!match) return 0;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + minutes;
}

/** Parses an ISO 8601 duration like "PT3H25M" into "3h 25m". */
export function formatIsoDuration(duration: string | null | undefined): string {
  if (!duration) return "";
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!match) return duration;
  const hours = match[1] ? `${match[1]}h` : "";
  const minutes = match[2] ? `${match[2]}m` : "";
  return [hours, minutes].filter(Boolean).join(" ") || "0m";
}

/** System timestamps (created_at, expires_at, etc.) are UTC ISO 8601 — safe to convert to the viewer's local time. */
export function formatSystemTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
