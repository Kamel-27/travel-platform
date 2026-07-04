// The backend never returns airport/city display names (Duffel's
// NormalizedOffer only has IATA codes) — this static table is the only
// source for human-readable labels anywhere in the app. Previously
// duplicated between the homepage and the flights page with different
// entries; this is the single shared copy.
export interface Airport {
  code: string;
  city: string;
  cityAr: string;
  country: string;
  countryAr: string;
}

export const AIRPORTS: Airport[] = [
  { code: "RUH", city: "Riyadh", cityAr: "الرياض", country: "Saudi Arabia", countryAr: "السعودية" },
  { code: "JED", city: "Jeddah", cityAr: "جدة", country: "Saudi Arabia", countryAr: "السعودية" },
  { code: "DMM", city: "Dammam", cityAr: "الدمام", country: "Saudi Arabia", countryAr: "السعودية" },
  { code: "MED", city: "Medina", cityAr: "المدينة المنورة", country: "Saudi Arabia", countryAr: "السعودية" },
  { code: "DXB", city: "Dubai", cityAr: "دبي", country: "UAE", countryAr: "الإمارات" },
  { code: "AUH", city: "Abu Dhabi", cityAr: "أبوظبي", country: "UAE", countryAr: "الإمارات" },
  { code: "SHJ", city: "Sharjah", cityAr: "الشارقة", country: "UAE", countryAr: "الإمارات" },
  { code: "DOH", city: "Doha", cityAr: "الدوحة", country: "Qatar", countryAr: "قطر" },
  { code: "BAH", city: "Bahrain", cityAr: "البحرين", country: "Bahrain", countryAr: "البحرين" },
  { code: "KWI", city: "Kuwait", cityAr: "الكويت", country: "Kuwait", countryAr: "الكويت" },
  { code: "MCT", city: "Muscat", cityAr: "مسقط", country: "Oman", countryAr: "عمان" },
  { code: "AMM", city: "Amman", cityAr: "عمّان", country: "Jordan", countryAr: "الأردن" },
  { code: "BEY", city: "Beirut", cityAr: "بيروت", country: "Lebanon", countryAr: "لبنان" },
  { code: "CAI", city: "Cairo", cityAr: "القاهرة", country: "Egypt", countryAr: "مصر" },
  { code: "IST", city: "Istanbul", cityAr: "إسطنبول", country: "Turkey", countryAr: "تركيا" },
  { code: "LHR", city: "London", cityAr: "لندن", country: "United Kingdom", countryAr: "بريطانيا" },
  { code: "CDG", city: "Paris", cityAr: "باريس", country: "France", countryAr: "فرنسا" },
  { code: "JFK", city: "New York", cityAr: "نيويورك", country: "United States", countryAr: "أمريكا" },
  { code: "BKK", city: "Bangkok", cityAr: "بانكوك", country: "Thailand", countryAr: "تايلاند" },
  { code: "KUL", city: "Kuala Lumpur", cityAr: "كوالالمبور", country: "Malaysia", countryAr: "ماليزيا" },
];

const POPULAR_CODES = ["RUH", "JED", "DXB", "DOH", "CAI", "IST", "LHR", "CDG"];

export function searchAirports(query: string): Airport[] {
  if (!query.trim()) return AIRPORTS.filter((a) => POPULAR_CODES.includes(a.code));
  const q = query.toLowerCase();
  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.cityAr.includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.countryAr.includes(q),
  ).slice(0, 8);
}

export function getAirportByCode(code: string): Airport | undefined {
  return AIRPORTS.find((a) => a.code === code.toUpperCase());
}

export function getAirportLabel(code: string): string {
  const airport = getAirportByCode(code);
  return airport ? `${airport.cityAr} (${airport.code})` : code;
}
