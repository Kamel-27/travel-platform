"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, apiFetchBlob, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { formatFlightTime, formatFlightDate, formatIsoDuration } from "@/lib/datetime";
import { getAirportLabel } from "@/lib/airports";
import type { Booking } from "@/lib/types";

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  size: number;
  color: string;
  duration: number;
}

// Seeded PRNG so the pieces are identical on server and client (no hydration mismatch)
function createRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function generateConfetti(): ConfettiPiece[] {
  const colors = ["#22c55e", "#4ade80", "#16a34a", "#86efac", "#3b82f6", "#2dd4bf"];
  const random = createRandom(42);
  return Array.from({ length: 60 }).map((_, i) => ({
    id: i,
    left: random() * 100, // percentage
    delay: random() * 4, // seconds
    size: random() * 8 + 6, // pixels
    color: colors[Math.floor(random() * colors.length)],
    duration: random() * 3 + 2, // seconds
  }));
}

function ConfirmationInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const { user } = useAuth();
  const isAdmin = user?.role === "technical_admin";
  const dashboardPath = isAdmin ? "/admin" : "/user-dashboard";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confetti] = useState<ConfettiPiece[]>(generateConfetti);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setTimeout(() => {
        setError("لم يتم تحديد رقم الحجز.");
        setLoading(false);
      }, 0);
      return;
    }

    let isMounted = true;

    async function loadBooking() {
      try {
        const data = await api.get<Booking>(`/bookings/${bookingId}`);
        if (!isMounted) return;
        setBooking(data);
        setLoading(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setError(err.message || "فشل تحميل تفاصيل الحجز المؤكد.");
        } else {
          setError("حدث خطأ غير متوقع أثناء تحميل تفاصيل الحجز.");
        }
        setLoading(false);
      }
    }

    void loadBooking();

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  // While the booking is still "paid" (payment succeeded but the airline
  // order hasn't been confirmed by Duffel yet), keep polling instead of
  // showing the success page prematurely.
  useEffect(() => {
    if (!bookingId || booking?.status !== "paid") return;

    let cancelled = false;
    const timerId = setInterval(async () => {
      try {
        const data = await api.get<Booking>(`/bookings/${bookingId}`);
        if (!cancelled) setBooking(data);
      } catch {
        // Silently ignore — will retry on next tick.
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(timerId);
    };
  }, [bookingId, booking?.status]);

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleActionClick = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDownloadTicket = async () => {
    if (!bookingId || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const blob = await apiFetchBlob(`/bookings/${bookingId}/ticket.pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ticket-${bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      handleActionClick(
        err instanceof ApiError ? err.message : "تعذّر تحميل التذكرة، يرجى المحاولة لاحقاً.",
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center gap-md" dir="rtl">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-title-md">جاري تحميل تفاصيل الحجز المؤكد...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-error text-5xl">error</span>
        <p className="font-title-md text-on-surface max-w-md">{error}</p>
        <Link href="/flights" className="mt-md bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md">
          العودة للبحث عن رحلات
        </Link>
      </div>
    );
  }

  // Payment succeeded but the airline order isn't confirmed yet — keep the
  // user informed instead of showing a premature success page (this state
  // resolves automatically via polling above, usually within a minute).
  if (booking?.status === "paid") {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center gap-md text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-primary text-6xl animate-spin">progress_activity</span>
        <h1 className="font-headline-md text-headline-md font-bold">تم استلام دفعتك بنجاح</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          جاري تأكيد حجزك مع شركة الطيران الآن، عادة ما تستغرق هذه الخطوة أقل من دقيقة. لا تغلق هذه الصفحة.
        </p>
      </div>
    );
  }

  // Order fulfillment came back negative (or the sweep gave up waiting on
  // Duffel) — the backend auto-refunds in this case, so be upfront about it.
  if (booking?.status === "order_failed" || booking?.status === "failed") {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-error-container/40 flex items-center justify-center">
          <span className="material-symbols-outlined text-error text-4xl">error</span>
        </div>
        <h1 className="font-headline-md text-headline-md font-bold">تعذّر تأكيد الحجز مع شركة الطيران</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          تم الدفع بنجاح، لكن تعذّر إتمام الحجز مع شركة الطيران. سيتم استرداد المبلغ المدفوع بالكامل تلقائياً خلال دقائق.
        </p>
        <Link href="/support" className="mt-sm bg-primary text-on-primary px-lg py-3 rounded-xl font-label-md text-label-md font-bold">
          تواصل مع الدعم
        </Link>
      </div>
    );
  }

  // Any other status (awaiting_payment, cancelled, refunded, ...) means this
  // booking never reached "confirmed" — don't show the success page.
  if (booking?.status !== "confirmed") {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-outline text-5xl">info</span>
        <p className="font-title-md text-on-surface max-w-md">
          حالة هذا الحجز الحالية: {booking?.status ?? "غير معروفة"}
        </p>
        <Link href="/user-dashboard" className="mt-md bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md">
          الذهاب إلى لوحة تحكم رحلاتي
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans relative overflow-x-hidden" dir="rtl">
      {/* Confetti Falling Effect */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute top-0 rounded-sm opacity-80 animate-[fall_linear_infinite]"
            style={{
              left: `${c.left}%`,
              width: `${c.size}px`,
              height: `${c.size}px`,
              backgroundColor: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes fall {
          0% {
            transform: translateY(-50px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>

      <SiteHeader />

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-inverse-surface border border-outline-variant text-inverse-on-surface px-lg py-md rounded-xl shadow-2xl flex items-center gap-base">
          <span className="material-symbols-outlined">info</span>
          <span className="font-label-md">{toastMessage}</span>
        </div>
      )}

      {/* Celebration Hero Section */}
      <section className="relative overflow-hidden bg-surface-container-low py-xl px-margin-mobile border-b border-outline-variant/30">
        <div className="max-w-max-width mx-auto flex flex-col items-center text-center relative z-10">
          {/* Success Badge */}
          <div className="mb-md animate-[bounce_2s_infinite]">
            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <span className="material-symbols-outlined text-[48px] text-green-500 font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold mb-xs">تم تأكيد حجزك بنجاح! 🎉</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            رقم مرجع الحجز الإلكتروني (PNR):{" "}
            <span className="font-bold text-primary select-all text-lg font-mono">
              {booking?.booking_reference ? `#${booking.booking_reference}` : "جاري إصدار رقم التأكيد..."}
            </span>
          </p>
        </div>
      </section>

      {/* Main Content Grid */}
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-lg pb-xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
          {/* Left Column: Trip Overview Card */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-md border-b border-outline-variant bg-surface-container-low">
                <h2 className="font-title-lg text-title-lg font-bold flex items-center gap-base">
                  <span className="material-symbols-outlined text-primary">flight_takeoff</span>
                  تفاصيل الرحلة والمسافرين
                </h2>
              </div>
              
              <div className="p-md space-y-md">
                {/* Flight Info Segment */}
                {booking?.snapshot?.slices.map((slice, sliceIndex) => (
                  <div key={slice.id} className="p-md bg-surface-bright rounded-xl border border-outline-variant space-y-md">
                    <div className="flex items-center justify-between border-b border-outline-variant/30 pb-xs">
                      <div className="flex items-center gap-xs">
                        <span className="material-symbols-outlined text-primary">airline_seat_recline_extra</span>
                        <p className="font-label-md text-label-md text-on-surface-variant font-bold">
                          {booking.snapshot?.owner_airline_name}
                        </p>
                      </div>
                      <span className="text-xs bg-primary/10 text-primary px-sm py-[2px] rounded-full font-bold">
                        {sliceIndex === 0 ? "ذهاب" : "عودة"}
                      </span>
                    </div>

                    {slice.segments.map((segment) => (
                      <div key={segment.id} className="flex flex-col md:flex-row items-center justify-between gap-md">
                        <div className="flex flex-col">
                          <p className="font-label-sm text-label-sm text-on-surface-variant">رقم الرحلة</p>
                          <p className="font-title-lg text-title-lg font-bold text-on-surface">
                            {segment.marketing_carrier} {segment.flight_number}
                          </p>
                        </div>

                        <div className="flex items-center gap-lg flex-1 justify-center w-full mt-sm md:mt-0">
                          <div className="text-right">
                            <p className="font-headline-md text-headline-md font-bold text-on-surface">
                              {formatFlightTime(segment.departing_at.local)}
                            </p>
                            <p className="font-label-md text-label-md text-primary font-bold">{segment.marketing_carrier}</p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">{getAirportLabel(slice.origin)}</p>
                            <p className="text-[10px] text-on-surface-variant/70">{formatFlightDate(segment.departing_at.local)}</p>
                          </div>

                          <div className="flex-1 flex flex-col items-center relative px-md">
                            <span className="font-label-sm text-label-sm text-on-surface-variant mb-xs">
                              {formatIsoDuration(slice.duration)}
                            </span>
                            <div className="w-full h-[2px] bg-outline-variant relative">
                              <div className="absolute -top-1 right-0 w-2 h-2 rounded-full bg-primary"></div>
                              <div className="absolute -top-1 left-0 w-2 h-2 rounded-full bg-outline"></div>
                              <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -top-3 bg-surface-bright px-xs text-primary text-sm">flight</span>
                            </div>
                            <span className="font-label-sm text-label-sm text-green-500 font-bold mt-xs">
                              {slice.segments.length === 1 ? "مباشر" : `${slice.segments.length - 1} توقف`}
                            </span>
                          </div>

                          <div className="text-left">
                            <p className="font-headline-md text-headline-md font-bold text-on-surface">
                              {formatFlightTime(segment.arriving_at.local)}
                            </p>
                            <p className="font-label-md text-label-md text-primary font-bold">{segment.marketing_carrier}</p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">{getAirportLabel(slice.destination)}</p>
                            <p className="text-[10px] text-on-surface-variant/70">{formatFlightDate(segment.arriving_at.local)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Passenger details */}
                <div className="space-y-sm">
                  <h3 className="font-title-md text-title-md font-bold text-on-surface-variant flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary">people</span>
                    <span>المسافرين</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                    {booking?.passengers.map((p, index) => (
                      <div key={p.id} className="flex items-start gap-md p-md rounded-xl border border-outline-variant bg-surface-container-low">
                        <span className="material-symbols-outlined text-primary text-2xl">person</span>
                        <div>
                          <p className="font-label-sm text-label-sm text-on-surface-variant">المسافر {index + 1}</p>
                          <p className="font-body-lg text-body-lg font-bold text-on-surface">
                            {p.title === "mr" ? "السيد" : p.title === "mrs" ? "السيدة" : p.title === "ms" ? "الآنسة" : "المسافر"}{" "}
                            {p.given_name} {p.family_name}
                          </p>
                          <p className="text-xs text-on-surface-variant/70">{p.email || "بدون بريد إلكتروني"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Actions Panel */}
          <aside className="flex flex-col gap-md">
            <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
              <h3 className="font-title-lg text-title-lg mb-md font-bold border-b border-outline-variant/30 pb-sm">إجراءات الحجز</h3>
              <div className="flex flex-col gap-sm">
                
                {/* Primary PDF Download */}
                <button
                  onClick={() => void handleDownloadTicket()}
                  disabled={downloadingPdf}
                  className="w-full bg-primary hover:bg-primary-container text-white py-md px-md rounded-xl flex items-center justify-center gap-base font-label-md text-label-md shadow-md active:scale-95 transition-transform cursor-pointer font-bold border-0 disabled:opacity-60 disabled:cursor-wait"
                >
                  <span className="material-symbols-outlined">{downloadingPdf ? "progress_activity" : "download"}</span>
                  {downloadingPdf ? "جاري تحميل التذكرة..." : "تحميل تذكرة الطيران (PDF)"}
                </button>
                
                <div className="h-px bg-outline-variant/30 my-sm"></div>
                
                {/* Secondary Links */}
                <Link
                  href={`/bookings/${bookingId}`}
                  className="flex items-center justify-center gap-xs font-label-md text-label-md text-primary font-bold hover:underline cursor-pointer py-xs"
                >
                  <span className="material-symbols-outlined text-lg">airplane_ticket</span>
                  عرض صفحة الحجز الكاملة
                </Link>
                <Link
                  href={dashboardPath}
                  className="flex items-center justify-center gap-xs font-label-md text-label-md text-primary font-bold hover:underline cursor-pointer py-xs"
                >
                  <span className="material-symbols-outlined text-lg">dashboard</span>
                  الذهاب إلى لوحة تحكم رحلاتي
                </Link>
              </div>
            </div>

            {/* Support Card */}
            <div className="bg-secondary-container p-md rounded-xl border border-outline-variant/50 text-on-secondary-container flex items-center gap-md">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                <span className="material-symbols-outlined text-primary">support_agent</span>
              </div>
              <div>
                <p className="font-label-md text-label-md font-bold">هل تحتاج لأي مساعدة إضافية؟</p>
                <p className="font-label-sm text-label-sm opacity-80 mt-0.5">فريق دعم سفريات متواجد 24/7 لمساعدتكم.</p>
                <Link href="/support" className="text-primary font-bold text-label-sm hover:underline mt-1 block">افتح تذكرة دعم الآن</Link>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-on-surface flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        </div>
      }
    >
      <ConfirmationInner />
    </Suspense>
  );
}
