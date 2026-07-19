/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatFlightDate, formatIsoDuration, formatSystemTimestamp } from "@/lib/datetime";
import { getAirportLabel } from "@/lib/airports";
import type { Booking, CancellationQuote } from "@/lib/types";

export default function UserDashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  // Cancellation Modal State
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("customer_cancel");
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      setLoadingBookings(true);
      const res = await api.get<{ data: Booking[] }>("/bookings?limit=50");
      setBookings(res.data);
      setBookingsError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setBookingsError(err.message || "فشل تحميل قائمة الحجوزات.");
      } else {
        setBookingsError("حدث خطأ أثناء تحميل الحجوزات.");
      }
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  // Fetch bookings on mount
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === "technical_admin") {
        window.location.replace("/admin");
        return;
      }
      void loadBookings();
    }
  }, [isAuthenticated, loadBookings, user]);

  // Fetch cancellation quote when booking selection changes
  useEffect(() => {
    if (!cancellingBooking) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let isMounted = true;
    setLoadingQuote(true);
    setQuoteError(null);

    api.get<CancellationQuote>(`/bookings/${cancellingBooking.id}/cancellation-quote`)
      .then((data) => {
        if (!isMounted) return;
        setQuote(data);
        setLoadingQuote(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setQuoteError(err.message || "فشل تحميل تفاصيل الاسترجاع.");
        } else {
          setQuoteError("حدث خطأ أثناء تحميل تفاصيل الاسترجاع.");
        }
        setLoadingQuote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cancellingBooking]);

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBooking) return;

    setSubmittingCancel(true);
    setQuoteError(null);

    try {
      const result = await api.post<{ requires_admin: boolean; message?: string }>(
        `/bookings/${cancellingBooking.id}/cancel`,
        { reason: cancelReason }
      );

      if (result.requires_admin) {
        setCancelSuccessMsg(result.message || "تم تقديم طلب الإلغاء للمراجعة اليدوية بنجاح.");
      } else {
        setCancelSuccessMsg("تم إلغاء الحجز ومعالجة عملية الاسترداد المالي بنجاح!");
      }

      // Reload bookings to update status
      void loadBookings();

      setTimeout(() => {
        setCancellingBooking(null);
        setCancelSuccessMsg(null);
      }, 3000);

    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setQuoteError(err.message || "فشل إرسال طلب الإلغاء.");
      } else {
        setQuoteError("حدث خطأ أثناء إلغاء الحجز.");
      }
    } finally {
      setSubmittingCancel(false);
    }
  };

  const isUpcoming = (b: Booking) => {
    if (["cancelled", "failed", "order_failed", "refunded"].includes(b.status)) return false;
    if (b.status === "awaiting_payment" || b.status === "paid") return true;
    if (!b.snapshot) return false;
    // Check if there is at least one future segment
    return b.snapshot.slices.some((slice) =>
      slice.segments.some((seg) => new Date(seg.departing_at.local) > new Date())
    );
  };

  const upcomingBookings = bookings.filter(isUpcoming);
  const pastBookings = bookings.filter((b) => !isUpcoming(b));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-md" dir="rtl">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-title-md">جاري تحميل ملفك الشخصي...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-outline text-5xl">lock</span>
        <p className="font-title-md">يرجى تسجيل الدخول للوصول إلى لوحة التحكم الخاصة بك.</p>
        <Link href="/signin" className="mt-md bg-primary text-on-primary px-lg py-md rounded-xl font-bold font-title-lg shadow-md hover:opacity-90 active:scale-95 transition-all">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-lg grid grid-cols-1 md:grid-cols-12 gap-lg" dir="rtl">
        <aside className="md:col-span-3">
          <div className="bg-surface-container-lowest rounded-xl p-md shadow-sm border border-outline-variant/30 sticky top-24">
            <nav className="flex flex-col gap-base">
              <Link className="flex items-center gap-sm p-sm rounded-lg bg-primary/10 text-primary font-bold transition-all" href="/user-dashboard">
                <span className="material-symbols-outlined">event_available</span>
                <span className="font-label-md text-label-md">حجوزاتي</span>
              </Link>
              <Link className="flex items-center gap-sm p-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all" href="/support">
                <span className="material-symbols-outlined">support_agent</span>
                <span className="font-label-md text-label-md">الدعم والمساعدة</span>
              </Link>
              <button
                onClick={() => logout()}
                className="flex items-center gap-sm p-sm rounded-lg text-error hover:bg-error-container/20 transition-all border-0 text-right w-full bg-transparent cursor-pointer"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="font-label-md text-label-md">تسجيل الخروج</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="md:col-span-9 space-y-lg">
          <section className="flex flex-col md:flex-row md:items-end justify-between gap-base">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-primary font-bold">أهلاً بك، {user?.full_name || "المسافر"}</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {upcomingBookings.length > 0
                  ? `لديك ${upcomingBookings.length} رحلة قادمة مؤكدة.`
                  : "لا توجد رحلات قادمة قريبة."}
              </p>
            </div>
            <div>
              <Link href="/" className="bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md shadow-sm hover:scale-98 active:scale-95 transition-transform flex items-center gap-xs">
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>حجز رحلة جديدة</span>
              </Link>
            </div>
          </section>

          {/* Upcoming Trips Section */}
          <section className="space-y-md">
            <h2 className="font-title-lg text-title-lg flex items-center gap-xs font-bold text-on-surface">
              <span className="material-symbols-outlined text-primary">flight_takeoff</span>
              <span>الرحلات القادمة</span>
            </h2>

            {loadingBookings ? (
              <div className="p-xl text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
                <p className="mt-xs">جاري تحميل الرحلات القادمة...</p>
              </div>
            ) : bookingsError ? (
              <div className="p-md bg-error-container/20 border border-error rounded-xl text-error">
                {bookingsError}
              </div>
            ) : upcomingBookings.length === 0 ? (
              <div className="p-xl bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl text-outline mb-sm">flight</span>
                <p className="font-body-lg">لا توجد رحلات قادمة. ابدأ بالتخطيط لرحلتك القادمة الآن!</p>
              </div>
            ) : (
              <div className="space-y-md">
                {upcomingBookings.map((b) => (
                  <div key={b.id} className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 hover:border-primary/40 transition-colors group p-md flex flex-col justify-between gap-md">
                    <div className="flex justify-between items-start flex-wrap gap-sm border-b border-outline-variant/20 pb-sm">
                      <div>
                        <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                          {b.snapshot?.owner_airline_name || "رحلة طيران"}
                        </h3>
                        <p className="text-on-surface-variant font-label-sm mt-1">
                          رقم الحجز: <span className="font-mono font-bold">#{b.booking_reference || b.id.substring(0, 8).toUpperCase()}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-sm">
                        <span className="text-tertiary font-headline-md text-headline-md font-extrabold">
                          {formatMoney(b.total_amount, b.currency)}
                        </span>
                        {b.status === "confirmed" && (
                          <span className="bg-green-500/10 border border-green-500/30 text-green-500 font-label-sm text-label-sm px-sm py-1 rounded-full flex items-center gap-xs">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            <span>مؤكد</span>
                          </span>
                        )}
                        {b.status === "awaiting_payment" && (
                          <span className="bg-orange-500/10 border border-orange-500/30 text-orange-500 font-label-sm text-label-sm px-sm py-1 rounded-full flex items-center gap-xs">
                            <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                            <span>بانتظار الدفع</span>
                          </span>
                        )}
                        {b.status === "paid" && (
                          <span className="bg-teal-500/10 border border-teal-500/30 text-teal-500 font-label-sm text-label-sm px-sm py-1 rounded-full flex items-center gap-xs">
                            <span className="material-symbols-outlined text-[14px]">progress_activity</span>
                            <span>مدفوع (قيد التأكيد)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {b.snapshot?.slices.map((slice) => (
                      <div key={slice.id} className="text-sm pr-4 border-r-2 border-primary/20 space-y-xs my-xs">
                        <p className="font-bold text-on-surface">
                          {getAirportLabel(slice.origin)} ← {getAirportLabel(slice.destination)}
                          <span className="text-on-surface-variant font-normal">
                            {" "}· {slice.segments.map((seg) => `${seg.marketing_carrier} ${seg.flight_number}`).join(" / ")}
                          </span>
                        </p>
                        <p className="text-on-surface-variant text-xs">
                          المغادرة: {formatFlightDate(slice.segments[0].departing_at.local)} · {formatFlightTime(slice.segments[0].departing_at.local)} · {formatIsoDuration(slice.duration)}
                        </p>
                      </div>
                    ))}

                    <div className="flex justify-between items-center flex-wrap gap-sm border-t border-outline-variant/20 pt-sm mt-xs">
                      <span className="text-xs text-on-surface-variant">تاريخ الإنشاء: {formatSystemTimestamp(b.created_at)}</span>
                      <div className="flex gap-sm">
                        {b.status === "confirmed" && (
                          <button
                            onClick={() => setCancellingBooking(b)}
                            className="text-error border border-error hover:bg-error-container/20 px-md py-base rounded-lg font-label-md font-bold active:scale-95 transition-all cursor-pointer bg-transparent"
                          >
                            إلغاء الحجز
                          </button>
                        )}
                        {b.status === "awaiting_payment" && (
                          <Link
                            href={`/checkout/payment?booking_id=${b.id}`}
                            className="bg-orange-400 hover:bg-orange-500 text-on-tertiary-fixed font-bold font-label-md px-md py-base rounded-lg shadow-sm active:scale-95 transition-all text-center flex items-center justify-center"
                          >
                            إكمال الدفع
                          </Link>
                        )}
                        <Link
                          href={`/checkout/confirmation?booking_id=${b.id}`}
                          className="text-primary border border-primary hover:bg-primary/5 px-md py-base rounded-lg font-label-md font-bold transition-all text-center flex items-center justify-center"
                        >
                          تفاصيل الحجز
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past Trips Section */}
          <section className="space-y-md">
            <h2 className="font-title-lg text-title-lg flex items-center gap-xs font-bold text-on-surface pt-lg">
              <span className="material-symbols-outlined text-outline">history</span>
              <span>الرحلات السابقة / الملغاة</span>
            </h2>

            {loadingBookings ? null : pastBookings.length === 0 ? (
              <div className="p-md bg-surface-container-high/20 rounded-xl text-center text-on-surface-variant text-sm">
                لا توجد رحلات سابقة.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {pastBookings.map((b) => (
                  <div key={b.id} className="bg-surface-container-high/30 rounded-xl p-md border border-outline-variant/30 flex justify-between gap-base items-center opacity-85 hover:opacity-100 transition-opacity">
                    <div className="flex-grow space-y-[2px]">
                      <div className="flex justify-between items-start flex-wrap gap-xs">
                        <h4 className="font-label-md font-bold text-on-surface">
                          {b.snapshot?.owner_airline_name || "رحلة سابقة"}
                        </h4>
                        {b.status === "cancelled" && <span className="text-on-surface-variant text-xs bg-surface-container-high px-sm py-[2px] rounded-full">ملغى</span>}
                        {b.status === "refunded" && <span className="text-teal-400 text-xs bg-teal-500/10 px-sm py-[2px] rounded-full">مسترجع</span>}
                        {(b.status === "failed" || b.status === "order_failed") && <span className="text-red-400 text-xs bg-red-500/10 px-sm py-[2px] rounded-full">فشل</span>}
                      </div>
                      <p className="text-on-surface-variant font-label-sm">
                        {b.snapshot?.slices[0] ? `${getAirportLabel(b.snapshot.slices[0].origin)} ← ${getAirportLabel(b.snapshot.slices[0].destination)}` : ""}
                      </p>
                      {b.snapshot?.slices[0]?.segments[0]?.departing_at.local && (
                        <p className="text-on-surface-variant/70 text-[10px]">
                          {formatFlightDate(b.snapshot.slices[0].segments[0].departing_at.local)}
                        </p>
                      )}
                    </div>
                    <span className="text-on-surface-variant font-bold text-sm shrink-0">
                      {formatMoney(b.total_amount, b.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />

      {/* Cancellation Quote Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in-up">
            <header className="p-md border-b border-outline-variant/30 flex justify-between items-center">
              <h3 className="font-title-lg font-bold flex items-center gap-xs">
                <span className="material-symbols-outlined text-red-500">warning</span>
                <span>إلغاء حجز الطيران</span>
              </h3>
              <button
                onClick={() => setCancellingBooking(null)}
                className="text-on-surface-variant hover:text-on-surface bg-transparent border-0 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <form onSubmit={handleCancelSubmit} className="p-md space-y-md">
              {loadingQuote ? (
                <div className="py-xl text-center text-on-surface-variant flex flex-col items-center gap-base">
                  <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
                  <p>جاري احتساب سياسة استرداد المبلغ...</p>
                </div>
              ) : quoteError ? (
                <div className="bg-error-container/20 border border-error text-error p-md rounded-xl text-sm">
                  {quoteError}
                </div>
              ) : quote ? (
                <div className="space-y-md">
                  <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/30 space-y-xs text-sm text-on-surface-variant">
                    <div className="flex justify-between">
                      <span>إجمالي سعر الحجز الأصلي:</span>
                      <span className="font-bold">{formatMoney(cancellingBooking.total_amount, cancellingBooking.currency)}</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                      <span>رسوم الغرامة المفروضة:</span>
                      <span className="font-bold">{quote.penalty ? formatMoney(quote.penalty.amount, quote.penalty.currency) : "مجهول / لا يوجد"}</span>
                    </div>
                    <div className="flex justify-between text-primary font-bold text-base border-t border-outline-variant/30 pt-xs mt-xs">
                      <span>المبلغ المسترد إليك:</span>
                      <span>{quote.customer_receives ? formatMoney(quote.customer_receives.amount, quote.customer_receives.currency) : "كامل المبلغ"}</span>
                    </div>
                  </div>

                  {quote.requires_admin && (
                    <div className="bg-orange-500/10 border border-orange-500/20 text-orange-600 p-md rounded-xl text-xs leading-relaxed flex gap-base items-start">
                      <span className="material-symbols-outlined shrink-0 mt-0.5">info</span>
                      <p>
                        <strong>ملاحظة هامة:</strong> هذا الحجز يتطلب مراجعة يدوية من قبل الدعم الفني لإكمال عملية الاسترجاع. سيتم تسجيل طلبك ومراجعته خلال 24 ساعة.
                      </p>
                    </div>
                  )}

                  <div className="space-y-xs">
                    <label className="text-sm text-on-surface-variant block">سبب إلغاء الحجز:</label>
                    <select
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-md text-on-surface font-label-md"
                    >
                      <option value="customer_cancel">تغيير في خطة السفر</option>
                      <option value="medical_reason">أسباب طبية طارئة</option>
                      <option value="scheduling_conflict">تضارب في المواعيد</option>
                      <option value="other">أخرى</option>
                    </select>
                  </div>
                </div>
              ) : null}

              {cancelSuccessMsg && (
                <div className="bg-teal-500/10 border border-teal-500/30 text-teal-600 p-md rounded-xl text-center text-sm font-bold animate-pulse">
                  {cancelSuccessMsg}
                </div>
              )}

              <footer className="flex justify-end gap-sm pt-md border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setCancellingBooking(null)}
                  className="bg-transparent border border-outline-variant hover:bg-surface-container-low text-on-surface font-label-md px-md py-base rounded-lg cursor-pointer"
                >
                  تراجع
                </button>
                {quote && !cancelSuccessMsg && (
                  <button
                    type="submit"
                    disabled={submittingCancel || loadingQuote}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold font-label-md px-lg py-base rounded-lg shadow-md active:scale-95 transition-all cursor-pointer border-0"
                  >
                    {submittingCancel ? "جاري الإلغاء..." : "تأكيد إلغاء الحجز"}
                  </button>
                )}
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
