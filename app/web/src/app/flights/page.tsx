"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import AirportInput from "@/components/AirportInput";
import { useAuth } from "@/lib/auth-context";
import { getAirportLabel } from "@/lib/airports";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatIsoDuration, parseIsoDurationMinutes } from "@/lib/datetime";
import type { NormalizedOffer, Paginated } from "@/lib/types";

type TripType = "one-way" | "round-trip";
type SortMode = "cheapest" | "fastest";

// Results survive navigating to checkout/payment and back — without this,
// every back-navigation re-fires a live Duffel search and the user stares
// at skeletons for no reason.
const RESULTS_CACHE_KEY = "safariyat_flight_results";
const RESULTS_CACHE_TTL_MS = 10 * 60 * 1000;

function readResultsCache(key: string): NormalizedOffer[] | null {
  try {
    const raw = sessionStorage.getItem(RESULTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { key: string; at: number; offers: NormalizedOffer[] };
    if (parsed.key !== key || Date.now() - parsed.at > RESULTS_CACHE_TTL_MS) return null;
    return parsed.offers;
  } catch {
    return null;
  }
}

function writeResultsCache(key: string, offers: NormalizedOffer[]) {
  try {
    sessionStorage.setItem(RESULTS_CACHE_KEY, JSON.stringify({ key, at: Date.now(), offers }));
  } catch {
    // Storage full/unavailable — caching is best-effort only.
  }
}

function totalDurationMinutes(offer: NormalizedOffer): number {
  return offer.slices.reduce((sum, slice) => sum + parseIsoDurationMinutes(slice.duration), 0);
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) return "خدمة البحث عن الرحلات غير متاحة حالياً، يرجى المحاولة لاحقاً";
    if (err.status === 429) return "عدد كبير من الطلبات، يرجى المحاولة بعد قليل";
    if (err.status === 400) return "بيانات البحث غير صحيحة، يرجى التحقق من المطارات والتواريخ";
    return err.message;
  }
  return "حدث خطأ أثناء البحث";
}

function FlightCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md animate-pulse space-y-sm">
      <div className="flex items-center gap-sm">
        <div className="w-10 h-10 bg-surface-container-high rounded-full" />
        <div className="h-4 w-32 bg-surface-container-high rounded" />
      </div>
      <div className="h-10 w-full bg-surface-container-high rounded" />
      <div className="h-6 w-40 bg-surface-container-high rounded" />
    </div>
  );
}

function OfferCard({ offer }: { offer: NormalizedOffer }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/40 transition-all group">
      <div className="p-md space-y-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 rounded-full border border-outline-variant bg-white flex items-center justify-center overflow-hidden shrink-0">
              {offer.airline.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={offer.airline.logo_url} alt={offer.airline.name} className="w-7 h-7 object-contain" />
              ) : (
                <span className="material-symbols-outlined text-primary">flight</span>
              )}
            </div>
            <div>
              <p className="font-label-md text-label-md text-on-surface font-bold">{offer.airline.name}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant capitalize">
                {offer.cabin_class === "economy" ? "الدرجة الاقتصادية" : offer.cabin_class.replace("_", " ")}
              </p>
            </div>
          </div>
          {offer.slices.length > 1 && (
            <span className="bg-secondary-container text-on-secondary-container px-sm py-1 rounded-full font-label-sm text-label-sm">
              ذهاب وعودة
            </span>
          )}
        </div>

        {offer.slices.map((slice, i) => {
          const firstSeg = slice.segments[0];
          const lastSeg = slice.segments[slice.segments.length - 1];
          const stops = slice.segments.length - 1;
          return (
            <div key={i} className="flex items-center justify-between gap-base border-t border-outline-variant/50 pt-sm first:border-t-0 first:pt-0">
              <div className="text-center min-w-[72px]">
                <p className="font-headline-md text-headline-md text-on-surface">{formatFlightTime(firstSeg.departing_at.local)}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{getAirportLabel(slice.origin)}</p>
              </div>
              <div className="flex-1 flex flex-col items-center px-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant">{formatIsoDuration(slice.duration)}</span>
                <div className="w-full flex items-center gap-1 my-1">
                  <span className="w-2 h-2 rounded-full border-2 border-primary bg-white shrink-0" />
                  <span className="flex-1 h-px bg-outline-variant relative">
                    <span className="material-symbols-outlined absolute -top-3 left-1/2 -translate-x-1/2 text-primary text-[18px] bg-surface-container-lowest px-1 -scale-x-100">flight</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                </div>
                <span className={`font-label-sm text-label-sm px-sm py-0.5 rounded-full ${stops === 0 ? "bg-secondary-container/60 text-primary" : "text-on-surface-variant bg-surface-container"}`}>
                  {stops === 0 ? "مباشرة" : stops === 1 ? "توقف واحد" : `${stops} توقفات`}
                </span>
              </div>
              <div className="text-center min-w-[72px]">
                <p className="font-headline-md text-headline-md text-on-surface">{formatFlightTime(lastSeg.arriving_at.local)}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{getAirportLabel(slice.destination)}</p>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between border-t border-dashed border-outline-variant pt-sm">
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant">السعر الإجمالي شامل الضرائب</p>
            <p className="font-headline-md text-headline-md text-primary font-bold">
              {formatMoney(offer.total.amount, offer.total.currency)}
            </p>
          </div>
          <Link
            href={`/checkout?offer_id=${encodeURIComponent(offer.offer_id)}`}
            className="bg-primary text-on-primary px-lg py-3 rounded-xl font-label-md text-label-md font-bold hover:bg-primary-container transition-all active:scale-95 shadow-sm flex items-center gap-xs"
          >
            <span>اختيار الرحلة</span>
            <span className="material-symbols-outlined !text-[18px]">arrow_back</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function FlightsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "technical_admin";
  const dashboardPath = isAdmin ? "/admin" : "/user-dashboard";

  const initialOrigin = searchParams.get("origin") || "RUH";
  const initialDest = searchParams.get("destination") || "DXB";
  const initialDate = searchParams.get("date") || searchParams.get("departure_date") || "";
  const initialReturnDate = searchParams.get("return_date") || "";
  const initialAdults = searchParams.get("adults") || "1";
  const initialTripType: TripType = initialReturnDate ? "round-trip" : "one-way";

  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDest);
  const [date, setDate] = useState(initialDate);
  const [returnDate, setReturnDate] = useState(initialReturnDate);
  const [adults, setAdults] = useState(initialAdults);
  const [tripType, setTripType] = useState<TripType>(initialTripType);

  const [offers, setOffers] = useState<NormalizedOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("cheapest");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [stopsFilter, setStopsFilter] = useState<number | null>(null);

  const cacheKeyFor = (o: string, d: string, dt: string, a: string, retDate?: string) =>
    `${o.toUpperCase()}|${d.toUpperCase()}|${dt}|${a}|${retDate || ""}`;

  const fetchFlights = useCallback(
    async (o: string, d: string, dt: string, a: string, retDate?: string) => {
      if (!o || !d || !dt) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          origin: o.toUpperCase(),
          destination: d.toUpperCase(),
          departure_date: dt,
          adults: a,
          children: "0",
          infants: "0",
          cabin_class: "economy",
        });
        if (retDate) params.set("return_date", retDate);

        const result = await api.get<Paginated<NormalizedOffer>>(`/flights/search?${params}`, {
          skipAuth: true,
        });
        setOffers(result.data || []);
        writeResultsCache(cacheKeyFor(o, d, dt, a, retDate), result.data || []);
      } catch (err) {
        setError(errorMessage(err));
        setOffers([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(() => {
      // Restore cached results (e.g. returning from checkout) instead of
      // re-running a slow live search on every back-navigation.
      const cached = readResultsCache(
        cacheKeyFor(initialOrigin, initialDest, initialDate, initialAdults, initialReturnDate),
      );
      if (cached && cached.length > 0) {
        setOffers(cached);
        setLoading(false);
        return;
      }
      return fetchFlights(initialOrigin, initialDest, initialDate, initialAdults, initialReturnDate);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams({ origin, destination, date, adults });
    if (tripType === "round-trip" && returnDate) params.set("return_date", returnDate);
    router.push(`/flights?${params}`);
    fetchFlights(origin, destination, date, adults, tripType === "round-trip" ? returnDate : undefined);
  };

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const displayedOffers = useMemo(() => {
    let list = [...offers];
    if (maxPrice !== null) list = list.filter((o) => o.total.amount <= maxPrice);
    if (stopsFilter !== null) {
      list = list.filter((o) => o.slices.every((s) => s.segments.length - 1 <= stopsFilter));
    }
    if (sortBy === "cheapest") {
      list.sort((a, b) => a.total.amount - b.total.amount);
    } else {
      list.sort((a, b) => totalDurationMinutes(a) - totalDurationMinutes(b));
    }
    return list;
  }, [offers, sortBy, maxPrice, stopsFilter]);

  const priceRange = useMemo(() => {
    if (offers.length === 0) return { min: 0, max: 0 };
    const amounts = offers.map((o) => o.total.amount);
    return { min: Math.min(...amounts), max: Math.max(...amounts) };
  }, [offers]);

  const fieldLabel = "font-label-sm text-label-sm text-on-surface-variant block mb-1 px-1";

  return (
    <div className="min-h-screen bg-background text-on-surface" dir="rtl">
      <header className="bg-surface-container-lowest shadow-sm sticky top-0 z-50 border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary">سفريات</Link>
          <nav className="flex items-center gap-md">
            <Link href="/manage-bookings" className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">رحلاتي</Link>
            <Link href={dashboardPath} className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">حسابي</Link>
          </nav>
        </div>
      </header>

      {/* Search panel */}
      <section className="bg-gradient-to-b from-primary to-primary-container pb-lg pt-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl p-md space-y-sm">
            <div className="flex gap-sm">
              <button
                type="button"
                onClick={() => { setTripType("one-way"); setReturnDate(""); }}
                className={`px-md py-1.5 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer ${tripType === "one-way" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
              >
                ذهاب فقط
              </button>
              <button
                type="button"
                onClick={() => setTripType("round-trip")}
                className={`px-md py-1.5 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer ${tripType === "round-trip" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
              >
                ذهاب وعودة
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1fr_1fr_1fr_auto_auto] gap-sm items-end">
              <div className="col-span-2 md:col-span-1">
                <label className={fieldLabel}>من</label>
                <AirportInput icon="flight_takeoff" value={origin} onChange={setOrigin} placeholder="مطار المغادرة" />
              </div>
              <div className="hidden md:flex items-center justify-center pb-1.5">
                <button
                  type="button"
                  onClick={handleSwap}
                  title="تبديل المطارات"
                  className="w-10 h-10 rounded-full border border-outline-variant bg-surface-container-low text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined !text-[20px]">swap_horiz</span>
                </button>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className={fieldLabel}>إلى</label>
                <AirportInput icon="flight_land" value={destination} onChange={setDestination} placeholder="مطار الوصول" />
              </div>
              <div>
                <label className={fieldLabel}>{tripType === "round-trip" ? "تاريخ الذهاب" : "التاريخ"}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-3 font-body-md text-body-md focus:border-primary focus:ring-0 transition-all"
                />
              </div>
              {tripType === "round-trip" ? (
                <div>
                  <label className={fieldLabel}>تاريخ العودة</label>
                  <input
                    type="date"
                    min={date || undefined}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-3 font-body-md text-body-md focus:border-primary focus:ring-0 transition-all"
                  />
                </div>
              ) : (
                <div className="hidden md:block" />
              )}
              <div>
                <label className={fieldLabel}>المسافرون</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none !text-[20px]">person</span>
                  <select
                    value={adults}
                    onChange={(e) => setAdults(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-3 font-body-md text-body-md focus:border-primary focus:ring-0 appearance-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={String(n)}>{n === 1 ? "بالغ واحد" : n === 2 ? "بالغان" : `${n} بالغين`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <button
                  onClick={handleSearch}
                  className="w-full md:w-auto bg-tertiary text-on-tertiary rounded-lg py-3 px-lg font-label-md text-label-md font-bold flex items-center justify-center gap-xs hover:bg-tertiary-container transition-all active:scale-95 shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined">search</span>
                  بحث
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-lg grid grid-cols-1 md:grid-cols-4 gap-lg">
        <aside className="md:col-span-1 space-y-md">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md space-y-md">
            <h3 className="font-title-md text-title-md flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary !text-[20px]">tune</span>
              تصفية النتائج
            </h3>

            <div>
              <h4 className="font-label-md text-label-md font-bold text-on-surface-variant mb-sm">التوقفات</h4>
              <div className="flex flex-col gap-xs">
                {[
                  { label: "الكل", value: null },
                  { label: "مباشرة فقط", value: 0 },
                  { label: "توقف واحد أو أقل", value: 1 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setStopsFilter(opt.value)}
                    className={`text-right px-3 py-2 rounded-lg font-label-md text-label-md transition-colors cursor-pointer ${stopsFilter === opt.value ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {priceRange.max > 0 && (
              <div className="pt-sm border-t border-outline-variant">
                <h4 className="font-label-md text-label-md font-bold text-on-surface-variant mb-sm">الحد الأقصى للسعر</h4>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={maxPrice ?? priceRange.max}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  حتى {formatMoney(maxPrice ?? priceRange.max, offers[0]?.total.currency ?? "USD")}
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="md:col-span-3 space-y-md">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <div>
              <h2 className="font-title-lg text-title-lg text-on-surface">
                {getAirportLabel(origin)} إلى {getAirportLabel(destination)}
              </h2>
              {!loading && !error && (
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {displayedOffers.length > 0 ? `${displayedOffers.length} رحلة متاحة` : ""}
                </p>
              )}
            </div>
            <div className="flex bg-surface-container rounded-full p-1 gap-1">
              <button
                onClick={() => setSortBy("cheapest")}
                className={`px-md py-1.5 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer ${sortBy === "cheapest" ? "bg-surface-container-lowest text-primary font-bold shadow-sm" : "text-on-surface-variant"}`}
              >
                الأرخص
              </button>
              <button
                onClick={() => setSortBy("fastest")}
                className={`px-md py-1.5 rounded-full font-label-sm text-label-sm transition-colors cursor-pointer ${sortBy === "fastest" ? "bg-surface-container-lowest text-primary font-bold shadow-sm" : "text-on-surface-variant"}`}
              >
                الأسرع
              </button>
            </div>
          </div>

          {loading && (
            <>
              <div className="bg-secondary-container/50 border border-primary/20 rounded-xl p-sm flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary animate-spin !text-[20px]">progress_activity</span>
                <p className="font-label-md text-label-md text-on-surface-variant">جارِ البحث عن أفضل الرحلات المتاحة...</p>
              </div>
              <FlightCardSkeleton />
              <FlightCardSkeleton />
              <FlightCardSkeleton />
            </>
          )}

          {!loading && error && (
            <div className="bg-error-container/20 border border-error rounded-xl p-lg text-center space-y-sm">
              <span className="material-symbols-outlined text-error text-4xl">error</span>
              <p className="font-body-md text-body-md text-on-surface">{error}</p>
              <button
                onClick={handleSearch}
                className="bg-primary text-on-primary px-lg py-2 rounded-lg font-label-md text-label-md cursor-pointer"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {!loading && !error && displayedOffers.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center space-y-sm">
              <span className="material-symbols-outlined text-outline text-5xl">travel_explore</span>
              <p className="font-title-md text-title-md text-on-surface">لا توجد رحلات مطابقة لبحثك</p>
              <p className="font-body-md text-body-md text-on-surface-variant">جرّب تغيير التواريخ أو المطارات أو إزالة الفلاتر</p>
            </div>
          )}

          {!loading &&
            !error &&
            displayedOffers.map((offer) => <OfferCard key={offer.offer_id} offer={offer} />)}
        </section>
      </main>
    </div>
  );
}

export default function FlightsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        </div>
      }
    >
      <FlightsInner />
    </Suspense>
  );
}
