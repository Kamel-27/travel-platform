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
  name?: string;
  nameAr?: string;
  type?: string;
}

export const AIRPORTS: Airport[] = [
  { code: "RUH", city: "Riyadh", cityAr: "الرياض", country: "Saudi Arabia", countryAr: "السعودية", name: "King Khalid International Airport", nameAr: "مطار الملك خالد الدولي", type: "airport" },
  { code: "JED", city: "Jeddah", cityAr: "جدة", country: "Saudi Arabia", countryAr: "السعودية", name: "King Abdulaziz International Airport", nameAr: "مطار الملك عبدالعزيز الدولي", type: "airport" },
  { code: "DMM", city: "Dammam", cityAr: "الدمام", country: "Saudi Arabia", countryAr: "السعودية", name: "King Fahd International Airport", nameAr: "مطار الملك فهد الدولي", type: "airport" },
  { code: "MED", city: "Medina", cityAr: "المدينة المنورة", country: "Saudi Arabia", countryAr: "السعودية", name: "Prince Mohammad bin Abdulaziz International Airport", nameAr: "مطار الأمير محمد بن عبدالعزيز الدولي", type: "airport" },
  { code: "DXB", city: "Dubai", cityAr: "دبي", country: "UAE", countryAr: "الإمارات", name: "Dubai International Airport", nameAr: "مطار دبي الدولي", type: "airport" },
  { code: "AUH", city: "Abu Dhabi", cityAr: "أبوظبي", country: "UAE", countryAr: "الإمارات", name: "Abu Dhabi International Airport", nameAr: "مطار أبوظبي الدولي", type: "airport" },
  { code: "SHJ", city: "Sharjah", cityAr: "الشارقة", country: "UAE", countryAr: "الإمارات", name: "Sharjah International Airport", nameAr: "مطار الشارقة الدولي", type: "airport" },
  { code: "DOH", city: "Doha", cityAr: "الدوحة", country: "Qatar", countryAr: "قطر", name: "Hamad International Airport", nameAr: "مطار حمد الدولي", type: "airport" },
  { code: "BAH", city: "Bahrain", cityAr: "البحرين", country: "Bahrain", countryAr: "البحرين", name: "Bahrain International Airport", nameAr: "مطار البحرين الدولي", type: "airport" },
  { code: "KWI", city: "Kuwait", cityAr: "الكويت", country: "Kuwait", countryAr: "الكويت", name: "Kuwait International Airport", nameAr: "مطار الكويت الدولي", type: "airport" },
  { code: "MCT", city: "Muscat", cityAr: "مسقط", country: "Oman", countryAr: "عمان", name: "Muscat International Airport", nameAr: "مطار مسقط الدولي", type: "airport" },
  { code: "AMM", city: "Amman", cityAr: "عمّان", country: "Jordan", countryAr: "الأردن", name: "Queen Alia International Airport", nameAr: "مطار الملكة علياء الدولي", type: "airport" },
  { code: "BEY", city: "Beirut", cityAr: "بيروت", country: "Lebanon", countryAr: "لبنان", name: "Beirut-Rafic Hariri International Airport", nameAr: "مطار بيروت رفيق الحريري الدولي", type: "airport" },
  { code: "CAI", city: "Cairo", cityAr: "القاهرة", country: "Egypt", countryAr: "مصر", name: "Cairo International Airport", nameAr: "مطار القاهرة الدولي", type: "airport" },
  { code: "IST", city: "Istanbul", cityAr: "إسطنبول", country: "Turkey", countryAr: "تركيا", name: "Istanbul Airport", nameAr: "مطار إسطنبول الدولي", type: "airport" },
  { code: "LHR", city: "London", cityAr: "لندن", country: "United Kingdom", countryAr: "بريطانيا", name: "London Heathrow Airport", nameAr: "مطار لندن هيثرو", type: "airport" },
  { code: "CDG", city: "Paris", cityAr: "باريس", country: "France", countryAr: "فرنسا", name: "Paris Charles de Gaulle Airport", nameAr: "مطار باريس شارل ديغول", type: "airport" },
  { code: "JFK", city: "New York", cityAr: "نيويورك", country: "United States", countryAr: "أمريكا", name: "John F. Kennedy International Airport", nameAr: "مطار جون إف كينيدي الدولي", type: "airport" },
  { code: "BKK", city: "Bangkok", cityAr: "بانكوك", country: "Thailand", countryAr: "تايلاند", name: "Suvarnabhumi Airport", nameAr: "مطار سوفارنابومي الدولي", type: "airport" },
  { code: "KUL", city: "Kuala Lumpur", cityAr: "كوالالمبور", country: "Malaysia", countryAr: "ماليزيا", name: "Kuala Lumpur International Airport", nameAr: "مطار كوالالمبور الدولي", type: "airport" },
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
