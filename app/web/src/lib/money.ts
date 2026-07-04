// Matches the backend's minor-unit decimal map exactly
// (app/Backend/src/duffel/duffel.service.ts toMinorUnits) so the frontend
// never mis-renders 0-decimal (JPY/KRW/HUF) or 3-decimal (KWD/BHD/OMR/JOD/LYD)
// currencies by assuming 2 decimals.
const MINOR_UNIT_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  HUF: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  LYD: 3,
};

export function decimalsForCurrency(currency: string): number {
  return MINOR_UNIT_DECIMALS[currency.toUpperCase()] ?? 2;
}

/** Converts an integer minor-unit amount (e.g. 154200) to a display number (e.g. 1542.00). */
export function toMajorUnits(amountMinor: number, currency: string): number {
  const decimals = decimalsForCurrency(currency);
  return amountMinor / Math.pow(10, decimals);
}

export function formatMoney(amountMinor: number, currency: string, locale = "en-US"): string {
  const decimals = decimalsForCurrency(currency);
  const major = toMajorUnits(amountMinor, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(major);
  } catch {
    // Unknown/unsupported ISO code for Intl — fall back to a plain number + code.
    return `${major.toFixed(decimals)} ${currency.toUpperCase()}`;
  }
}
