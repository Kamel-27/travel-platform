"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiBaggage {
  type: "carry_on" | "checked";
  quantity: number;
}

interface ApiSegment {
  flightNumber: string;
  marketingCarrier?: string;
  marketingCarrierCode?: string;
  operatingCarrier?: string;
  operatingCarrierCode?: string;
  operatingFlightNumber?: string;
  departureAirport: string;
  departureAirportName?: string;
  departureCityName?: string;
  arrivalAirport: string;
  arrivalAirportName?: string;
  arrivalCityName?: string;
  departureTerminal?: string | null;
  arrivalTerminal?: string | null;
  departureTime: string;
  arrivalTime: string;
  duration?: string | null;
  aircraft?: string | null;
  cabinClass?: string;
  cabinClassMarketingName?: string | null;
  baggages?: ApiBaggage[];
}

interface ApiSlice {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration?: string | null;
  fareBrandName?: string | null;
  segments: ApiSegment[];
  stops: number;
}

interface SliceDisplay {
  origin: string;
  destination: string;
  departureTime: string;
  departureHour: number;
  arrivalTime: string;
  duration: string;
  stops: number;
  segments: SegmentDisplay[];
  fareBrandName?: string | null;
}

interface SegmentDisplay {
  flightNumber: string;
  departureAirport: string;
  departureAirportName?: string;
  departureCityName?: string;
  arrivalAirport: string;
  arrivalAirportName?: string;
  arrivalCityName?: string;
  departureTime: string;
  arrivalTime: string;
  aircraft?: string | null;
  cabinClass?: string;
  cabinClassMarketingName?: string | null;
  marketingCarrier?: string;
  operatingCarrier?: string;
  departureTerminal?: string | null;
  arrivalTerminal?: string | null;
  checkedBaggage: number;
  carryOnBaggage: number;
}

interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  airlineLogo?: string | null;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  departureHour: number;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: number;
  currency: string;
  cabin: string;
  checkedBaggage: number;
  carryOnBaggage: number;
  totalEmissionsKg?: string | null;
  expiresAt?: string | null;
  slices: SliceDisplay[];
  isRoundTrip: boolean;
}

interface Airport {
  code: string;
  city: string;
  cityAr: string;
  country: string;
  countryAr: string;
}

type TripType = "one-way" | "round-trip";
type CurrencyMode = "USD" | "EGP";

const EGP_RATE = 49.5;

// ---------------------------------------------------------------------------
// Airport Data
// ---------------------------------------------------------------------------

const AIRPORTS: Airport[] = [
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
  { code: "CMN", city: "Casablanca", cityAr: "الدار البيضاء", country: "Morocco", countryAr: "المغرب" },
  { code: "TUN", city: "Tunis", cityAr: "تونس", country: "Tunisia", countryAr: "تونس" },
  { code: "ALG", city: "Algiers", cityAr: "الجزائر", country: "Algeria", countryAr: "الجزائر" },
  { code: "IST", city: "Istanbul", cityAr: "إسطنبول", country: "Turkey", countryAr: "تركيا" },
  { code: "LHR", city: "London", cityAr: "لندن", country: "United Kingdom", countryAr: "بريطانيا" },
  { code: "CDG", city: "Paris", cityAr: "باريس", country: "France", countryAr: "فرنسا" },
  { code: "FRA", city: "Frankfurt", cityAr: "فرانكفورت", country: "Germany", countryAr: "ألمانيا" },
  { code: "FCO", city: "Rome", cityAr: "روما", country: "Italy", countryAr: "إيطاليا" },
  { code: "BCN", city: "Barcelona", cityAr: "برشلونة", country: "Spain", countryAr: "إسبانيا" },
  { code: "JFK", city: "New York", cityAr: "نيويورك", country: "United States", countryAr: "أمريكا" },
  { code: "LAX", city: "Los Angeles", cityAr: "لوس أنجلوس", country: "United States", countryAr: "أمريكا" },
  { code: "BKK", city: "Bangkok", cityAr: "بانكوك", country: "Thailand", countryAr: "تايلاند" },
  { code: "KUL", city: "Kuala Lumpur", cityAr: "كوالالمبور", country: "Malaysia", countryAr: "ماليزيا" },
  { code: "SIN", city: "Singapore", cityAr: "سنغافورة", country: "Singapore", countryAr: "سنغافورة" },
  { code: "DEL", city: "Delhi", cityAr: "دلهي", country: "India", countryAr: "الهند" },
  { code: "BOM", city: "Mumbai", cityAr: "مومباي", country: "India", countryAr: "الهند" },
  { code: "NRT", city: "Tokyo", cityAr: "طوكيو", country: "Japan", countryAr: "اليابان" },
  { code: "ICN", city: "Seoul", cityAr: "سيول", country: "South Korea", countryAr: "كوريا الجنوبية" },
  { code: "GVA", city: "Geneva", cityAr: "جنيف", country: "Switzerland", countryAr: "سويسرا" },
  { code: "ZRH", city: "Zurich", cityAr: "زيورخ", country: "Switzerland", countryAr: "سويسرا" },
  { code: "DPS", city: "Bali", cityAr: "بالي", country: "Indonesia", countryAr: "إندونيسيا" },
  { code: "MLE", city: "Maldives", cityAr: "المالديف", country: "Maldives", countryAr: "المالديف" },
];

const POPULAR_CODES = ["RUH", "JED", "DXB", "DOH", "CAI", "IST", "LHR", "CDG"];

function searchAirports(query: string): Airport[] {
  if (!query.trim()) {
    return AIRPORTS.filter((a) => POPULAR_CODES.includes(a.code));
  }
  const q = query.toLowerCase();
  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.cityAr.includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.countryAr.includes(q)
  ).slice(0, 8);
}

function getAirportByCode(code: string): Airport | undefined {
  return AIRPORTS.find((a) => a.code === code.toUpperCase());
}

function getDisplayLabel(code: string): string {
  const airport = getAirportByCode(code);
  return airport ? `${airport.cityAr} (${airport.code})` : code;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFlightDuration(departure: string, arrival: string): string {
  const ms = new Date(arrival).getTime() - new Date(departure).getTime();
  if (isNaN(ms) || ms <= 0) return "";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h ? `${h}h` : ""}${m ? ` ${m}m` : ""}`.trim();
}

function formatIsoDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const h = match[1] ? parseInt(match[1]) : 0;
  const m = match[2] ? parseInt(match[2]) : 0;
  return `${h ? `${h}h` : ""}${m ? ` ${m}m` : ""}`.trim();
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getWeekLaterDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 8);
  return d.toISOString().split("T")[0];
}

function formatDateAr(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ar-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });
}

function formatPrice(price: number, currency: CurrencyMode): string {
  const value = currency === "EGP" ? price * EGP_RATE : price;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function parseDuration(d: string): number {
  const hours = d.match(/(\d+)h/);
  const mins = d.match(/(\d+)m/);
  return (hours ? parseInt(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1]) : 0);
}

// ---------------------------------------------------------------------------
// Airport Input Component
// ---------------------------------------------------------------------------

function AirportInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon: string;
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Airport[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResults(searchAirports(query));
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayValue = value ? getDisplayLabel(value) : "";

  return (
    <div className="flex flex-col gap-xs relative" ref={ref}>
      <label className="font-label-sm text-label-sm opacity-80">{label}</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
          {icon}
        </span>
        <input
          className="w-full bg-surface-container-lowest text-on-surface rounded-lg pr-10 pl-3 py-2.5 font-body-md border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={placeholder}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {!query.trim() && (
            <div className="px-3 py-1.5 text-on-surface-variant font-label-sm text-label-sm border-b border-outline-variant/50">
              المطارات الشائعة
            </div>
          )}
          {results.map((airport) => (
            <button
              key={airport.code}
              type="button"
              className="w-full text-right px-3 py-2.5 hover:bg-primary-container/40 transition-colors flex items-center gap-3 cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(airport.code);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="material-symbols-outlined text-outline text-[20px]">
                flight
              </span>
              <div className="flex-1">
                <div className="font-body-md text-on-surface">
                  {airport.cityAr}
                  <span className="text-on-surface-variant font-label-sm mr-2">
                    {airport.countryAr}
                  </span>
                </div>
              </div>
              <span className="font-title-md text-primary font-bold">
                {airport.code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Airline Logo Component
// ---------------------------------------------------------------------------

function AirlineLogo({ code, name, logoUrl }: { code: string; name: string; logoUrl?: string | null }) {
  const [imgError, setImgError] = useState(false);
  const fallback = (code || name || "??").substring(0, 2).toUpperCase();

  const src = logoUrl || (code ? `https://pics.avs.io/60/60/${code}.png` : null);

  if (!src || imgError) {
    return (
      <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
        <span className="font-title-md text-title-md text-on-primary-container">
          {fallback}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className="w-10 h-10 rounded-lg object-contain bg-surface-container-lowest shrink-0"
      onError={() => setImgError(true)}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton Card Component
// ---------------------------------------------------------------------------

function FlightCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden animate-pulse">
      <div className="p-md flex flex-col md:flex-row items-center gap-lg">
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 items-center gap-md">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high" />
            <div className="flex flex-col gap-xs">
              <div className="h-4 w-24 bg-surface-container-high rounded" />
              <div className="h-3 w-16 bg-surface-container-high rounded" />
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-between w-full px-md">
            <div className="h-6 w-12 bg-surface-container-high rounded" />
            <div className="flex-1 mx-lg h-[2px] bg-surface-container-high rounded" />
            <div className="h-6 w-12 bg-surface-container-high rounded" />
          </div>
        </div>
        <div className="w-full md:w-48 flex flex-col items-center gap-base">
          <div className="h-6 w-24 bg-surface-container-high rounded" />
          <div className="h-10 w-full bg-surface-container-high rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slice Row Component (used for both outbound and return)
// ---------------------------------------------------------------------------

function SliceRow({ slice, label }: { slice: SliceDisplay; label?: string }) {
  const stops = slice.stops;
  const stopsLabel =
    stops === 0
      ? "مباشر"
      : stops === 1
      ? "1 توقف"
      : `${stops} توقفات`;

  return (
    <div className="flex-1 w-full">
      {label && (
        <div className="flex items-center gap-xs mb-sm">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            {label === "ذهاب" ? "flight_takeoff" : "flight_land"}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
        </div>
      )}
      <div className="flex items-center justify-between w-full">
        <div className="text-center">
          <span className="font-headline-md text-headline-md block">
            {slice.departureTime}
          </span>
          <span className="font-label-md text-label-md text-outline">
            {slice.origin}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center px-lg">
          <span className="font-label-sm text-label-sm text-outline mb-xs">
            {slice.duration}
          </span>
          <div className="relative w-full h-[2px] bg-outline-variant">
            {stops > 0 &&
              Array.from({ length: stops }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-error rounded-full"
                  style={{
                    left: `${((i + 1) / (stops + 1)) * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
          </div>
          <span
            className={`font-label-sm text-label-sm mt-xs ${
              stops === 0 ? "text-primary" : "text-error"
            }`}
          >
            {stopsLabel}
          </span>
        </div>
        <div className="text-center">
          <span className="font-headline-md text-headline-md block">
            {slice.arrivalTime}
          </span>
          <span className="font-label-md text-label-md text-outline">
            {slice.destination}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flight Card Component
// ---------------------------------------------------------------------------

function FlightCard({ flight, currency }: { flight: Flight; currency: CurrencyMode }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const priceFormatted = formatPrice(flight.price, currency);
  const outbound = flight.slices[0];
  const returnSlice = flight.slices.length > 1 ? flight.slices[1] : null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
      <div className="p-md flex flex-col md:flex-row items-center gap-lg">
        <div className="flex-1 w-full flex flex-col gap-md">
          <div className="flex items-center gap-md">
            <AirlineLogo code={flight.airlineCode} name={flight.airline} logoUrl={flight.airlineLogo} />
            <div className="flex flex-col">
              <span className="font-title-md text-title-md leading-tight">
                {flight.airline}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {flight.flightNumber}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-md">
            <SliceRow slice={outbound} label={returnSlice ? "ذهاب" : undefined} />
            {returnSlice && (
              <>
                <div className="border-t border-outline-variant/50" />
                <SliceRow slice={returnSlice} label="عودة" />
              </>
            )}
          </div>
        </div>

        <div className="w-full md:w-48 md:border-r border-outline-variant md:pr-lg flex flex-row md:flex-col justify-between md:justify-center items-center gap-base">
          <div className="text-right md:text-center">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              يبدأ من
            </span>
            <div className="font-headline-md text-headline-md text-tertiary">
              {priceFormatted} {currency}
            </div>
          </div>
          <Link
            href="/flights/details"
            className="bg-primary text-on-primary w-full md:w-auto px-xl py-sm rounded-lg font-label-md text-label-md hover:brightness-110 active:scale-95 transition-all text-center flex items-center justify-center"
          >
            اختيار
          </Link>
        </div>
      </div>

      <div className="bg-surface-container-low px-md py-xs flex justify-between items-center border-t border-outline-variant">
        <div className="flex gap-md flex-wrap">
          {flight.cabin && (
            <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">
                airline_seat_recline_extra
              </span>
              {flight.cabin}
            </span>
          )}
          {flight.checkedBaggage > 0 && (
            <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">luggage</span>
              {flight.checkedBaggage} حقيبة
            </span>
          )}
          {flight.carryOnBaggage > 0 && (
            <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">backpack</span>
              حقيبة يد
            </span>
          )}
          {flight.totalEmissionsKg && (
            <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">eco</span>
              {parseFloat(flight.totalEmissionsKg).toFixed(0)} kg CO₂
            </span>
          )}
        </div>
        <button
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="text-primary font-label-sm text-label-sm flex items-center gap-xs cursor-pointer"
        >
          تفاصيل الرحلة{" "}
          <span className={`material-symbols-outlined text-[16px] transition-transform ${detailsOpen ? "rotate-180" : ""}`}>
            keyboard_arrow_down
          </span>
        </button>
      </div>

      {detailsOpen && (
        <div className="bg-surface-container-low px-md py-md border-t border-outline-variant/50">
          {flight.slices.map((slice, si) => (
            <div key={si} className={si > 0 ? "mt-md pt-md border-t border-outline-variant/50" : ""}>
              {flight.isRoundTrip && (
                <div className="flex items-center gap-xs mb-sm">
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    {si === 0 ? "flight_takeoff" : "flight_land"}
                  </span>
                  <span className="font-label-md text-label-md font-bold">
                    {si === 0 ? "رحلة الذهاب" : "رحلة العودة"}
                  </span>
                  {slice.fareBrandName && (
                    <span className="font-label-sm text-label-sm text-on-surface-variant mr-auto">
                      {slice.fareBrandName}
                    </span>
                  )}
                </div>
              )}
              {!flight.isRoundTrip && slice.fareBrandName && (
                <div className="mb-sm">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {slice.fareBrandName}
                  </span>
                </div>
              )}
              {slice.segments.map((seg, segi) => (
                <div key={segi} className={`flex flex-col gap-xs ${segi > 0 ? "mt-sm pt-sm border-t border-dashed border-outline-variant/50" : ""}`}>
                  <div className="flex items-center justify-between flex-wrap gap-sm">
                    <div className="flex items-center gap-sm">
                      <span className="font-body-md text-on-surface font-bold">{seg.flightNumber}</span>
                      {seg.marketingCarrier && (
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {seg.marketingCarrier}
                        </span>
                      )}
                      {seg.operatingCarrier && seg.operatingCarrier !== seg.marketingCarrier && seg.operatingCarrier !== flight.airline && (
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          · تشغيل {seg.operatingCarrier}
                        </span>
                      )}
                    </div>
                    {seg.aircraft && (
                      <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">flight</span>
                        {seg.aircraft}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-lg text-on-surface font-label-sm text-label-sm">
                    <div className="flex flex-col items-start">
                      <span className="font-bold">{seg.departureTime}</span>
                      <span className="text-on-surface-variant">
                        {seg.departureAirportName || seg.departureAirport}
                        {seg.departureTerminal && ` · T${seg.departureTerminal}`}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[14px] text-outline">arrow_back</span>
                    <div className="flex flex-col items-start">
                      <span className="font-bold">{seg.arrivalTime}</span>
                      <span className="text-on-surface-variant">
                        {seg.arrivalAirportName || seg.arrivalAirport}
                        {seg.arrivalTerminal && ` · T${seg.arrivalTerminal}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-md flex-wrap">
                    {seg.cabinClassMarketingName && (
                      <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">airline_seat_recline_extra</span>
                        {seg.cabinClassMarketingName}
                      </span>
                    )}
                    {seg.checkedBaggage > 0 && (
                      <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">luggage</span>
                        {seg.checkedBaggage} حقيبة مسجلة
                      </span>
                    )}
                    {seg.carryOnBaggage > 0 && (
                      <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">backpack</span>
                        حقيبة يد
                      </span>
                    )}
                    {seg.checkedBaggage === 0 && (
                      <span className="flex items-center gap-xs font-label-sm text-label-sm text-error">
                        <span className="material-symbols-outlined text-[14px]">luggage</span>
                        بدون حقائب مسجلة
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component that uses useSearchParams
// ---------------------------------------------------------------------------

function FlightsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialOrigin = searchParams.get("origin") || "RUH";
  const initialDest = searchParams.get("destination") || "DXB";
  const initialDate = searchParams.get("date") || getTomorrowDate();
  const initialReturnDate = searchParams.get("return_date") || "";
  const initialAdults = searchParams.get("adults") || "1";
  const initialTripType: TripType = searchParams.get("return_date") ? "round-trip" : "one-way";

  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDest);
  const [date, setDate] = useState(initialDate);
  const [returnDate, setReturnDate] = useState(initialReturnDate);
  const [adults, setAdults] = useState(initialAdults);
  const [tripType, setTripType] = useState<TripType>(initialTripType);
  const [isEditing, setIsEditing] = useState(false);

  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"cheapest" | "fastest" | "best">("cheapest");
  const [currency, setCurrency] = useState<CurrencyMode>("USD");

  // Filters
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [stopsFilter, setStopsFilter] = useState<Set<number>>(new Set());
  const [timeFilter, setTimeFilter] = useState<string | null>(null);

  const toggleStopFilter = (val: number) => {
    setStopsFilter((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  const clearFilters = () => {
    setMaxPrice(10000);
    setStopsFilter(new Set());
    setTimeFilter(null);
  };

  const fetchFlights = useCallback(
    async (o: string, d: string, dt: string, a: string, retDate?: string) => {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const params = new URLSearchParams({
          origin: o.toUpperCase(),
          destination: d.toUpperCase(),
          departure_date: dt,
          adults_count: a,
          cabin_class: "economy",
        });
        if (retDate) {
          params.set("return_date", retDate);
        }

        const res = await fetch(`${apiBase}/api/v1/flights?${params}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "حدث خطأ أثناء البحث");
        }

        const mapped: Flight[] = (data.data || [])
          .filter((f: Record<string, unknown>) => {
            const price = Number(f.price);
            return price > 0 && f.departureAirport !== "N/A";
          })
          .map((f: any) => {
            const apiSlices: ApiSlice[] = f.slices || [];
            const slices: SliceDisplay[] = apiSlices.map((slice: ApiSlice) => {
              const depDate = new Date(slice.departureTime);
              const arrDate = new Date(slice.arrivalTime);
              const segments: SegmentDisplay[] = (slice.segments || []).map((seg: ApiSegment) => {
                const checked = (seg.baggages || []).find((b: ApiBaggage) => b.type === "checked");
                const carryOn = (seg.baggages || []).find((b: ApiBaggage) => b.type === "carry_on");
                return {
                  flightNumber: seg.flightNumber,
                  departureAirport: seg.departureAirport,
                  departureAirportName: seg.departureAirportName,
                  departureCityName: seg.departureCityName,
                  arrivalAirport: seg.arrivalAirport,
                  arrivalAirportName: seg.arrivalAirportName,
                  arrivalCityName: seg.arrivalCityName,
                  departureTime: new Date(seg.departureTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                  arrivalTime: new Date(seg.arrivalTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                  aircraft: seg.aircraft,
                  cabinClass: seg.cabinClass,
                  cabinClassMarketingName: seg.cabinClassMarketingName,
                  marketingCarrier: seg.marketingCarrier,
                  operatingCarrier: seg.operatingCarrier,
                  departureTerminal: seg.departureTerminal,
                  arrivalTerminal: seg.arrivalTerminal,
                  checkedBaggage: checked?.quantity ?? 0,
                  carryOnBaggage: carryOn?.quantity ?? 0,
                };
              });
              return {
                origin: slice.origin,
                destination: slice.destination,
                departureTime: depDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                departureHour: depDate.getHours(),
                arrivalTime: arrDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                duration: slice.duration
                  ? formatIsoDuration(slice.duration)
                  : formatFlightDuration(slice.departureTime, slice.arrivalTime),
                stops: slice.stops ?? 0,
                segments,
                fareBrandName: slice.fareBrandName,
              };
            });

            // Fallback: build a slice from flat fields if API didn't return slices
            if (slices.length === 0 && f.departureTime && f.arrivalTime) {
              const depDate = new Date(f.departureTime as string);
              const arrDate = new Date(f.arrivalTime as string);
              slices.push({
                origin: f.departureAirport as string,
                destination: f.arrivalAirport as string,
                departureTime: depDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                departureHour: depDate.getHours(),
                arrivalTime: arrDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                duration: formatFlightDuration(f.departureTime as string, f.arrivalTime as string),
                stops: (f.stops as number) ?? 0,
                segments: [{
                  flightNumber: f.flightNumber as string,
                  departureAirport: f.departureAirport as string,
                  arrivalAirport: f.arrivalAirport as string,
                  departureTime: depDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                  arrivalTime: arrDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                  aircraft: null,
                  cabinClass: (f.cabinClass as string) || "economy",
                  cabinClassMarketingName: null,
                  operatingCarrier: undefined,
                  departureTerminal: null,
                  arrivalTerminal: null,
                  checkedBaggage: 0,
                  carryOnBaggage: 0,
                }],
                fareBrandName: null,
              });
            }

            const outbound = slices[0];
            const firstSeg = outbound?.segments?.[0];

            return {
              id: f.id as string,
              airline: f.airline as string,
              airlineCode: (f.airlineCode as string) || "",
              airlineLogo: (f.airlineLogo as string) || null,
              flightNumber: f.flightNumber as string,
              origin: outbound?.origin || (f.departureAirport as string),
              destination: outbound?.destination || (f.arrivalAirport as string),
              departureTime: outbound?.departureTime || "",
              departureHour: outbound?.departureHour ?? 0,
              arrivalTime: outbound?.arrivalTime || "",
              duration: outbound?.duration || "",
              stops: outbound?.stops ?? (f.stops as number) ?? 0,
              price: Number(f.price),
              currency: (f.currency as string) || "USD",
              cabin: firstSeg?.cabinClassMarketingName || firstSeg?.cabinClass || (f.cabinClass as string) || "economy",
              checkedBaggage: firstSeg?.checkedBaggage ?? 0,
              carryOnBaggage: firstSeg?.carryOnBaggage ?? 0,
              totalEmissionsKg: f.totalEmissionsKg ?? null,
              expiresAt: f.expiresAt ?? null,
              slices,
              isRoundTrip: slices.length > 1,
            };
          });

        setFlights(mapped);

        if (mapped.length > 0) {
          const max = Math.max(...mapped.map((f) => f.price));
          setMaxPrice(Math.ceil(max / 100) * 100);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === "AbortError") {
          setError("انتهت مهلة البحث. يرجى المحاولة مرة أخرى.");
        } else {
          setError(
            err instanceof Error ? err.message : "حدث خطأ أثناء البحث"
          );
        }
        setFlights([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchFlights(initialOrigin, initialDest, initialDate, initialAdults, initialReturnDate || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setIsEditing(false);
    const params = new URLSearchParams({
      origin,
      destination,
      date,
      adults,
    });
    if (tripType === "round-trip" && returnDate) {
      params.set("return_date", returnDate);
    }
    router.push(`/flights?${params}`);
    fetchFlights(origin, destination, date, adults, tripType === "round-trip" ? returnDate : undefined);
  };

  const handleSwapAirports = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Sort
  const sortedFlights = [...flights].sort((a, b) => {
    if (sortBy === "cheapest") return a.price - b.price;
    if (sortBy === "fastest") return parseDuration(a.duration) - parseDuration(b.duration);
    if (a.stops !== b.stops) return a.stops - b.stops;
    return a.price - b.price;
  });

  // Filter
  const filteredFlights = sortedFlights.filter((f) => {
    if (f.price > maxPrice) return false;
    if (stopsFilter.size > 0) {
      const bucket = f.stops >= 2 ? 2 : f.stops;
      if (!stopsFilter.has(bucket)) return false;
    }
    if (timeFilter === "morning" && (f.departureHour < 6 || f.departureHour >= 12)) return false;
    if (timeFilter === "afternoon" && (f.departureHour < 12 || f.departureHour >= 18)) return false;
    if (timeFilter === "evening" && (f.departureHour < 18)) return false;
    return true;
  });

  const cheapest = flights.length
    ? Math.min(...flights.map((f) => f.price))
    : 0;
  const fastest = flights.length
    ? flights.reduce(
        (min, f) => {
          const dur = parseDuration(f.duration);
          return dur < min.dur ? { dur, price: f.price } : min;
        },
        { dur: Infinity, price: 0 }
      )
    : { dur: 0, price: 0 };

  const priceMin = flights.length ? Math.floor(Math.min(...flights.map((f) => f.price))) : 0;
  const priceMax = flights.length ? Math.ceil(Math.max(...flights.map((f) => f.price))) : 10000;

  const activeOrigin = searchParams.get("origin") || origin;
  const activeDest = searchParams.get("destination") || destination;
  const activeReturnDate = searchParams.get("return_date") || returnDate;

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <>
      {/* Header */}
      <header className="bg-surface-container-lowest shadow-sm sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-16">
          <div className="flex items-center gap-lg">
            <Link href="/">
              <h1 className="font-headline-lg-mobile md:font-headline-lg text-primary font-bold cursor-pointer">
                سفريات
              </h1>
            </Link>
            <nav className="hidden md:flex items-center gap-md">
              <Link className="text-primary font-bold border-b-2 border-primary pb-1 font-label-md text-label-md" href="/flights">
                رحلات طيران
              </Link>
              <Link className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/hotels">
                فنادق
              </Link>
              <Link className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/#offers">
                عروض
              </Link>
              <Link className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/manage-bookings">
                رحلاتي
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-base">
            <button
              onClick={() => setCurrency((c) => (c === "USD" ? "EGP" : "USD"))}
              className="hidden md:flex items-center gap-sm px-3 py-1.5 rounded-full border border-outline-variant hover:bg-primary-container/40 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                currency_exchange
              </span>
              <span className="font-label-md text-label-md font-bold text-primary">
                {currency}
              </span>
            </button>
            <Link
              href="/signin"
              className="bg-primary text-on-primary px-md py-xs rounded-lg font-label-md text-label-md active:scale-95 transition-transform text-center flex items-center justify-center"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>

      {/* Search Summary / Edit Bar */}
      <section className="bg-primary-container text-on-primary-container py-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {!isEditing ? (
            <div className="flex flex-col md:flex-row justify-between items-center gap-base">
              <div className="flex items-center gap-md flex-wrap">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-on-primary-container">flight_takeoff</span>
                  <span className="font-title-lg text-title-lg">{getDisplayLabel(activeOrigin)}</span>
                </div>
                <span className="material-symbols-outlined text-on-primary-container">
                  {activeReturnDate ? "sync_alt" : "arrow_back"}
                </span>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-on-primary-container">flight_land</span>
                  <span className="font-title-lg text-title-lg">{getDisplayLabel(activeDest)}</span>
                </div>
                <div className="h-6 w-px bg-on-primary-container/30 mx-base hidden md:block" />
                <div className="flex flex-col md:flex-row md:items-center gap-base">
                  <span className="font-label-md text-label-md opacity-90">
                    {formatDateAr(date)}
                    {activeReturnDate && ` - ${formatDateAr(activeReturnDate)}`}
                  </span>
                  <span className="font-label-md text-label-md opacity-90">
                    {adults} مسافر
                    {activeReturnDate ? " · ذهاب وعودة" : " · ذهاب فقط"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="bg-surface-container-lowest text-primary px-md py-xs rounded-full font-label-md text-label-md hover:bg-on-primary transition-colors flex items-center gap-xs"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                تعديل البحث
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setTripType("one-way"); setReturnDate(""); }}
                  className={`px-4 py-1.5 rounded-full font-label-md text-label-md transition-colors ${
                    tripType === "one-way"
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-primary-container hover:bg-on-primary-container/10"
                  }`}
                >
                  ذهاب فقط
                </button>
                <button
                  type="button"
                  onClick={() => { setTripType("round-trip"); if (!returnDate) setReturnDate(getWeekLaterDate()); }}
                  className={`px-4 py-1.5 rounded-full font-label-md text-label-md transition-colors ${
                    tripType === "round-trip"
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-primary-container hover:bg-on-primary-container/10"
                  }`}
                >
                  ذهاب وعودة
                </button>
              </div>

              <div className="flex flex-col md:flex-row items-end gap-sm">
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-sm items-end">
                  <AirportInput label="من" icon="flight_takeoff" value={origin} onChange={setOrigin} placeholder="اختر مطار المغادرة" />
                  <button
                    type="button"
                    onClick={handleSwapAirports}
                    className="self-center md:self-end mb-1 w-9 h-9 rounded-full border border-outline-variant bg-surface-container-lowest flex items-center justify-center hover:bg-primary-container transition-colors"
                    title="تبديل"
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">swap_horiz</span>
                  </button>
                  <AirportInput label="إلى" icon="flight_land" value={destination} onChange={setDestination} placeholder="اختر مطار الوصول" />
                </div>

                <div className={`grid w-full md:w-auto gap-sm ${tripType === "round-trip" ? "grid-cols-2" : "grid-cols-1"}`}>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-sm text-label-sm opacity-80">
                      {tripType === "round-trip" ? "تاريخ الذهاب" : "التاريخ"}
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">calendar_today</span>
                      <input
                        type="date"
                        min={todayStr}
                        className="w-full md:w-40 bg-surface-container-lowest text-on-surface rounded-lg pr-10 pl-3 py-2.5 font-body-md border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          if (returnDate && e.target.value > returnDate) {
                            const d = new Date(e.target.value);
                            d.setDate(d.getDate() + 7);
                            setReturnDate(d.toISOString().split("T")[0]);
                          }
                        }}
                      />
                    </div>
                  </div>
                  {tripType === "round-trip" && (
                    <div className="flex flex-col gap-xs">
                      <label className="font-label-sm text-label-sm opacity-80">تاريخ العودة</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">calendar_today</span>
                        <input
                          type="date"
                          min={date || todayStr}
                          className="w-full md:w-40 bg-surface-container-lowest text-on-surface rounded-lg pr-10 pl-3 py-2.5 font-body-md border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                          value={returnDate}
                          onChange={(e) => setReturnDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-xs">
                  <label className="font-label-sm text-label-sm opacity-80">المسافرون</label>
                  <select
                    className="bg-surface-container-lowest text-on-surface rounded-lg px-3 py-2.5 font-body-md border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                    value={adults}
                    onChange={(e) => setAdults(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n} مسافر</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSearch}
                  className="bg-tertiary text-on-tertiary px-lg py-2.5 rounded-lg font-label-md text-label-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-xs whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[18px]">search</span>
                  بحث
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-lg grid grid-cols-1 md:grid-cols-12 gap-lg">
        {/* Filters Sidebar */}
        <aside className="md:col-span-3 order-1 md:order-2">
          <div className="bg-surface-container-lowest rounded-xl p-md shadow-sm sticky top-24">
            <div className="flex justify-between items-center mb-md">
              <h3 className="font-title-lg text-title-lg">تصفية النتائج</h3>
              <button onClick={clearFilters} className="text-primary font-label-sm text-label-sm hover:underline">
                مسح الكل
              </button>
            </div>

            {/* Price Range */}
            <div className="mb-lg">
              <label className="font-label-md text-label-md block mb-sm">
                الحد الأقصى للسعر ({currency})
              </label>
              <input
                className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                max={priceMax || 10000}
                min={priceMin || 0}
                step={10}
                type="range"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
              />
              <div className="flex justify-between mt-xs">
                <span className="font-label-sm text-label-sm text-outline">
                  {formatPrice(priceMin, currency)}
                </span>
                <span className="font-label-sm text-label-sm text-primary font-bold">
                  {formatPrice(maxPrice, currency)}
                </span>
              </div>
            </div>

            {/* Stops */}
            <div className="mb-lg">
              <label className="font-label-md text-label-md block mb-sm">عدد التوقفات</label>
              <div className="space-y-sm">
                {[
                  { val: 0, label: "مباشر" },
                  { val: 1, label: "توقف واحد" },
                  { val: 2, label: "توقفين أو أكثر" },
                ].map(({ val, label }) => (
                  <label key={val} className="flex items-center gap-base cursor-pointer">
                    <input
                      className="w-5 h-5 rounded border-outline text-primary focus:ring-primary"
                      type="checkbox"
                      checked={stopsFilter.has(val)}
                      onChange={() => toggleStopFilter(val)}
                    />
                    <span className="font-body-md text-body-md">{label}</span>
                    <span className="font-label-sm text-label-sm text-outline mr-auto">
                      ({flights.filter((f) => (val === 2 ? f.stops >= 2 : f.stops === val)).length})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Departure Time */}
            <div className="mb-lg">
              <label className="font-label-md text-label-md block mb-sm">وقت المغادرة</label>
              <div className="grid grid-cols-3 gap-base">
                {[
                  { key: "morning", icon: "wb_twilight", label: "صباحاً", sub: "6-12" },
                  { key: "afternoon", icon: "light_mode", label: "ظهراً", sub: "12-18" },
                  { key: "evening", icon: "dark_mode", label: "مساءً", sub: "18+" },
                ].map(({ key, icon, label, sub }) => (
                  <button
                    key={key}
                    onClick={() => setTimeFilter(timeFilter === key ? null : key)}
                    className={`border p-base rounded-lg text-center transition-colors ${
                      timeFilter === key
                        ? "border-primary bg-primary-container/50"
                        : "border-outline-variant hover:bg-secondary-container"
                    }`}
                  >
                    <span className="material-symbols-outlined block mb-xs text-[20px]">{icon}</span>
                    <span className="font-label-sm text-label-sm block">{label}</span>
                    <span className="font-label-sm text-label-sm text-outline block">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Currency Toggle (mobile) */}
            <div className="md:hidden">
              <button
                onClick={() => setCurrency((c) => (c === "USD" ? "EGP" : "USD"))}
                className="w-full flex items-center justify-center gap-sm px-3 py-2 rounded-lg border border-outline-variant hover:bg-primary-container/40 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">currency_exchange</span>
                <span className="font-label-md text-label-md">
                  {currency === "USD" ? "عرض بالجنيه المصري" : "عرض بالدولار"}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="md:col-span-9 order-2 md:order-1">
          {/* Sort Tabs */}
          {!loading && flights.length > 0 && (
            <div className="flex bg-surface-container-low rounded-xl p-xs mb-lg overflow-x-auto">
              <button
                onClick={() => setSortBy("cheapest")}
                className={`flex-1 min-w-[120px] py-sm px-base flex flex-col items-center rounded-lg transition-colors ${
                  sortBy === "cheapest" ? "bg-surface-container-lowest shadow-sm" : "hover:bg-surface-container-highest/50"
                }`}
              >
                <span className={`font-label-md text-label-md ${sortBy === "cheapest" ? "text-primary font-bold" : ""}`}>
                  الأرخص
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {formatPrice(cheapest, currency)} {currency}
                </span>
              </button>
              <button
                onClick={() => setSortBy("fastest")}
                className={`flex-1 min-w-[120px] py-sm px-base flex flex-col items-center rounded-lg transition-colors ${
                  sortBy === "fastest" ? "bg-surface-container-lowest shadow-sm" : "hover:bg-surface-container-highest/50"
                }`}
              >
                <span className={`font-label-md text-label-md ${sortBy === "fastest" ? "text-primary font-bold" : ""}`}>
                  الأسرع
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {formatPrice(fastest.price, currency)} {currency}
                </span>
              </button>
              <button
                onClick={() => setSortBy("best")}
                className={`flex-1 min-w-[120px] py-sm px-base flex flex-col items-center rounded-lg transition-colors ${
                  sortBy === "best" ? "bg-surface-container-lowest shadow-sm" : "hover:bg-surface-container-highest/50"
                }`}
              >
                <span className={`font-label-md text-label-md ${sortBy === "best" ? "text-primary font-bold" : ""}`}>
                  الأفضل
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  مباشر أولاً
                </span>
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="space-y-md">
              <div className="text-center mb-md">
                <p className="font-body-md text-on-surface-variant animate-pulse">
                  جاري البحث عن أفضل الرحلات...
                </p>
              </div>
              <FlightCardSkeleton />
              <FlightCardSkeleton />
              <FlightCardSkeleton />
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="bg-surface-container-lowest border border-error/30 rounded-xl p-xl text-center">
              <span className="material-symbols-outlined text-error mb-md block" style={{ fontSize: "48px" }}>
                error_outline
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">
                لم نتمكن من البحث عن الرحلات
              </h3>
              <p className="text-on-surface-variant font-body-md mb-md">{error}</p>
              <button
                onClick={() => fetchFlights(origin, destination, date, adults, tripType === "round-trip" ? returnDate : undefined)}
                className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md hover:brightness-110 active:scale-95 transition-all"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && flights.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center">
              <span className="material-symbols-outlined text-outline mb-md block" style={{ fontSize: "48px" }}>
                flight_takeoff
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">
                لا توجد رحلات متاحة
              </h3>
              <p className="text-on-surface-variant font-body-md">
                لم نعثر على رحلات لهذا المسار والتاريخ. جرّب تعديل معايير البحث.
              </p>
            </div>
          )}

          {/* No filter results */}
          {!loading && !error && flights.length > 0 && filteredFlights.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center">
              <span className="material-symbols-outlined text-outline mb-md block" style={{ fontSize: "48px" }}>
                filter_alt_off
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">
                لا توجد نتائج تطابق الفلاتر
              </h3>
              <p className="text-on-surface-variant font-body-md mb-md">
                جرّب تعديل معايير التصفية لعرض المزيد من الرحلات.
              </p>
              <button onClick={clearFilters} className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md hover:brightness-110 active:scale-95 transition-all">
                مسح الفلاتر
              </button>
            </div>
          )}

          {/* Results List */}
          {!loading && !error && filteredFlights.length > 0 && (
            <div className="space-y-md">
              {filteredFlights.map((flight) => (
                <FlightCard key={flight.id} flight={flight} currency={currency} />
              ))}
            </div>
          )}

          {/* Results Summary */}
          {!loading && flights.length > 0 && (
            <div className="mt-xl flex flex-col items-center">
              <p className="mt-base font-label-sm text-label-sm text-outline">
                عرض {filteredFlights.length} من {flights.length} رحلة متوفرة
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container border-t border-outline-variant mt-xl">
        <div className="w-full py-lg px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-lg">
          <div className="flex flex-col gap-base">
            <h2 className="font-headline-md text-headline-md font-extrabold text-primary">سفريات</h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md md:max-w-xl">
              شريكك الموثوق لاستكشاف العالم بكل سهولة وراحة. حجز طيران وفنادق بأفضل الأسعار.
            </p>
          </div>
          <div className="flex flex-wrap gap-xl">
            <div className="flex flex-col gap-sm">
              <span className="font-label-md text-label-md font-bold text-on-surface">عن سفريات</span>
              <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary hover:underline" href="/">من نحن</Link>
              <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary hover:underline" href="/support">اتصل بنا</Link>
            </div>
            <div className="flex flex-col gap-sm">
              <span className="font-label-md text-label-md font-bold text-on-surface">القانونية</span>
              <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary hover:underline" href="/">سياسة الخصوصية</Link>
              <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary hover:underline" href="/">الشروط والأحكام</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-outline-variant/30 py-md px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            © 2026 سفريات. جميع الحقوق محفوظة.
          </p>
          <div className="flex gap-md">
            <span className="material-symbols-outlined text-outline">social_leaderboard</span>
            <span className="material-symbols-outlined text-outline">alternate_email</span>
            <span className="material-symbols-outlined text-outline">share</span>
          </div>
        </div>
      </footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported page with Suspense boundary (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function FlightsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-primary font-headline-md">
            جاري التحميل...
          </div>
        </div>
      }
    >
      <FlightsInner />
    </Suspense>
  );
}
