"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import AirportInput from "@/components/AirportInput";
import { getAirportLabel } from "@/lib/airports";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatIsoDuration, parseIsoDurationMinutes } from "@/lib/datetime";
import type { NormalizedOffer, Paginated } from "@/lib/types";

type TripType = "one-way" | "round-trip";
type SortMode = "cheapest" | "fastest";

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
      <div className="h-4 w-32 bg-surface-container-high rounded" />
      <div className="h-6 w-full bg-surface-container-high rounded" />
      <div className="h-4 w-40 bg-surface-container-high rounded" />
    </div>
  );
}

function OfferCard({ offer }: { offer: NormalizedOffer }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="p-md space-y-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm">
            {offer.airline.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={offer.airline.logo_url} alt={offer.airline.name} className="w-8 h-8 object-contain" />
            ) : (
              <span className="material-symbols-outlined text-primary">flight</span>
            )}
            <span className="font-label-md text-label-md text-on-surface">{offer.airline.name}</span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant capitalize">{offer.cabin_class.replace("_", " ")}</span>
        </div>

        {offer.slices.map((slice, i) => {
          const firstSeg = slice.segments[0];
          const lastSeg = slice.segments[slice.segments.length - 1];
          const stops = slice.segments.length - 1;
          return (
            <div key={i} className="flex items-center justify-between gap-base border-t border-outline-variant/50 pt-sm first:border-t-0 first:pt-0">
              <div className="text-center">
                <p className="font-title-md text-title-md text-on-surface">{formatFlightTime(firstSeg.departing_at.local)}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{getAirportLabel(slice.origin)}</p>
              </div>
              <div className="flex-1 flex flex-col items-center px-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant">{formatIsoDuration(slice.duration)}</span>
                <div className="w-full h-px bg-outline-variant relative my-1">
                  <span className="material-symbols-outlined absolute -top-2.5 left-1/2 -translate-x-1/2 text-outline text-[16px] bg-surface-container-lowest">flight</span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {stops === 0 ? "مباشرة" : `${stops} توقف`}
                </span>
              </div>
              <div className="text-center">
                <p className="font-title-md text-title-md text-on-surface">{formatFlightTime(lastSeg.arriving_at.local)}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{getAirportLabel(slice.destination)}</p>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between border-t border-outline-variant pt-sm">
          <span className="font-headline-md text-headline-md text-primary">
            {formatMoney(offer.total.amount, offer.total.currency)}
          </span>
          <Link
            href={`/checkout?offer_id=${encodeURIComponent(offer.offer_id)}`}
            className="bg-primary text-on-primary px-md py-2 rounded-lg font-label-md text-label-md hover:brightness-110 transition-all active:scale-95"
          >
            اختيار
          </Link>
        </div>
      </div>
    </div>
  );
}

function FlightsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

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

  const fetchFlights = useCallback(
    async (o: string, d: string, dt: string, a: string, retDate?: string) => {
      if (!o || !d || !dt) return;
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
    void Promise.resolve().then(() =>
      fetchFlights(initialOrigin, initialDest, initialDate, initialAdults, initialReturnDate),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams({ origin, destination, date, adults });
    if (tripType === "round-trip" && returnDate) params.set("return_date", returnDate);
    router.push(`/flights?${params}`);
    fetchFlights(origin, destination, date, adults, tripType === "round-trip" ? returnDate : undefined);
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

  return (
    <div className="min-h-screen bg-background text-on-surface" dir="rtl">
      <header className="bg-surface-container-lowest shadow-sm sticky top-0 z-50 border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 py-md flex flex-col md:flex-row gap-base md:items-end">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary shrink-0 self-start md:self-auto">سفريات</Link>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-sm items-end">
            <div className="col-span-1 md:col-span-1">
              <AirportInput icon="flight_takeoff" value={origin} onChange={setOrigin} placeholder="من" />
            </div>
            <div className="col-span-1 md:col-span-1">
              <AirportInput icon="flight_land" value={destination} onChange={setDestination} placeholder="إلى" />
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg py-3 px-3 font-body-md text-body-md"
            />
            {tripType === "round-trip" && (
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg py-3 px-3 font-body-md text-body-md"
              />
            )}
            <select
              value={tripType}
              onChange={(e) => setTripType(e.target.value as TripType)}
              className="bg-surface-container-low border border-outline-variant rounded-lg py-3 px-2 font-body-md text-body-md"
            >
              <option value="one-way">ذهاب فقط</option>
              <option value="round-trip">ذهاب وعودة</option>
            </select>
            <input
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg py-3 px-3 font-body-md text-body-md w-full"
            />
            <button
              onClick={handleSearch}
              className="bg-tertiary text-on-tertiary rounded-lg py-3 px-4 font-label-md text-label-md flex items-center justify-center gap-xs"
            >
              <span className="material-symbols-outlined">search</span>
              بحث
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-lg grid grid-cols-1 md:grid-cols-4 gap-lg">
        <aside className="md:col-span-1 space-y-md">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md space-y-md">
            <h3 className="font-title-md text-title-md">الترتيب حسب</h3>
            <div className="flex flex-col gap-xs">
              <button
                onClick={() => setSortBy("cheapest")}
                className={`text-right px-3 py-2 rounded-lg font-label-md text-label-md ${sortBy === "cheapest" ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant"}`}
              >
                الأرخص
              </button>
              <button
                onClick={() => setSortBy("fastest")}
                className={`text-right px-3 py-2 rounded-lg font-label-md text-label-md ${sortBy === "fastest" ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant"}`}
              >
                الأسرع
              </button>
            </div>

            <h3 className="font-title-md text-title-md pt-sm border-t border-outline-variant">التوقفات</h3>
            <div className="flex flex-col gap-xs">
              {[
                { label: "الكل", value: null },
                { label: "مباشرة", value: 0 },
                { label: "توقف واحد أو أقل", value: 1 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setStopsFilter(opt.value)}
                  className={`text-right px-3 py-2 rounded-lg font-label-md text-label-md ${stopsFilter === opt.value ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {priceRange.max > 0 && (
              <>
                <h3 className="font-title-md text-title-md pt-sm border-t border-outline-variant">الحد الأقصى للسعر</h3>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={maxPrice ?? priceRange.max}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full"
                />
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  حتى {formatMoney(maxPrice ?? priceRange.max, offers[0]?.total.currency ?? "USD")}
                </p>
              </>
            )}
          </div>
        </aside>

        <section className="md:col-span-3 space-y-md">
          {loading && (
            <>
              <FlightCardSkeleton />
              <FlightCardSkeleton />
              <FlightCardSkeleton />
            </>
          )}

          {!loading && error && (
            <div className="bg-error-container/20 border border-error rounded-xl p-lg text-center space-y-sm">
              <span className="material-symbols-outlined text-error text-4xl">error</span>
              <p className="font-body-md text-body-md text-on-surface">{error}</p>
            </div>
          )}

          {!loading && !error && displayedOffers.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg text-center">
              <p className="font-body-md text-body-md text-on-surface-variant">لا توجد رحلات مطابقة لبحثك</p>
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
