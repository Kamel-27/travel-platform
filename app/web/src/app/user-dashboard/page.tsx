/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CancelBookingModal from "@/components/CancelBookingModal";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatFlightDate, formatIsoDuration, formatSystemTimestamp } from "@/lib/datetime";
import { getAirportLabel } from "@/lib/airports";
import type { Booking } from "@/lib/types";

export default function UserDashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  // Cancellation Modal State
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);

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
        <CancelBookingModal
          booking={cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          onCancelled={() => void loadBookings()}
        />
      )}
    </>
  );
}
