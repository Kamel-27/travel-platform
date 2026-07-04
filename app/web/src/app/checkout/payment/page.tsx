"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CheckoutStepper from "@/components/CheckoutStepper";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatIsoDuration } from "@/lib/datetime";
import { getAirportLabel } from "@/lib/airports";
import type { Booking, PaymentIntent } from "@/lib/types";

function PaymentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get("booking_id");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const pollingRef = useRef<boolean>(true);

  // 1. Fetch booking details and payment intent on mount
  useEffect(() => {
    if (!bookingId) {
      setTimeout(() => {
        setError("لم يتم تحديد رقم الحجز.");
        setLoading(false);
      }, 0);
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        // Fetch Booking
        const bookingData = await api.get<Booking>(`/bookings/${bookingId}`);
        if (!isMounted) return;

        setBooking(bookingData);

        // If already confirmed, redirect directly
        if (bookingData.status === "confirmed") {
          router.push(`/checkout/confirmation?booking_id=${bookingId}`);
          return;
        }

        // Fetch or create Payment Intent
        const intent = await api.post<PaymentIntent>(`/bookings/${bookingId}/payment-intent`);
        if (!isMounted) return;

        setPaymentIntent(intent);

        // Calculate initial remaining time from offer snapshot expiry
        if (bookingData.snapshot?.expires_at) {
          const expires = new Date(bookingData.snapshot.expires_at).getTime();
          const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000));
          setTimeLeft(remaining);
        }

        setLoading(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          if (err.status === 410) {
            setError("انتهت صلاحية حجز هذه الرحلة، يرجى البحث عن رحلة جديدة.");
          } else {
            setError(err.message || "فشل تحميل تفاصيل الدفع.");
          }
        } else {
          setError("حدث خطأ غير متوقع أثناء تحميل تفاصيل الدفع.");
        }
        setLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [bookingId, router]);

  // 2. Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          setError("انتهت صلاحية عرض الرحلة. يرجى البحث من جديد.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // 3. Polling for payment status (T4/T5 transitions)
  useEffect(() => {
    if (!bookingId || loading || error || booking?.status === "confirmed") return;

    pollingRef.current = true;
    let timerId: NodeJS.Timeout;

    const pollStatus = async () => {
      if (!pollingRef.current) return;
      try {
        const updatedBooking = await api.get<Booking>(`/bookings/${bookingId}`);
        if (!pollingRef.current) return;

        if (updatedBooking.status !== booking?.status) {
          setBooking(updatedBooking);
        }

        if (updatedBooking.status === "paid") {
          setStatusMessage("تم استلام الدفع بنجاح. جاري تأكيد حجزك مع شركة الطيران...");
        } else if (updatedBooking.status === "confirmed") {
          pollingRef.current = false;
          router.push(`/checkout/confirmation?booking_id=${bookingId}`);
          return;
        } else if (updatedBooking.status === "order_failed" || updatedBooking.status === "failed") {
          pollingRef.current = false;
          setError("فشل تأكيد الحجز. يرجى محاولة الدفع مرة أخرى أو الاتصال بالدعم.");
          return;
        }
      } catch (err) {
        // Silently ignore polling errors to remain resilient
        console.error("Polling error:", err);
      }

      if (pollingRef.current) {
        timerId = setTimeout(pollStatus, 3000);
      }
    };

    timerId = setTimeout(pollStatus, 3000);

    return () => {
      pollingRef.current = false;
      clearTimeout(timerId);
    };
  }, [bookingId, loading, error, booking?.status, router]);

  const formatTime = () => {
    if (timeLeft === null || timeLeft <= 0) return "0:00";
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-md" dir="rtl">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-title-md text-title-md text-on-surface">جاري تجهيز بوابة الدفع الآمنة...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-error-container/40 flex items-center justify-center">
          <span className="material-symbols-outlined text-error text-4xl">error</span>
        </div>
        <p className="font-title-md text-title-md text-on-surface max-w-md">{error}</p>
        <Link href="/flights" className="mt-sm bg-primary text-on-primary px-lg py-3 rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs">
          <span className="material-symbols-outlined !text-[18px]">search</span>
          العودة للبحث عن رحلات
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface" dir="rtl">
      <header className="bg-surface-container-lowest shadow-sm border-b border-outline-variant sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary">سفريات</Link>
          <div className="flex items-center gap-xs text-on-surface-variant">
            <span className="material-symbols-outlined !text-[18px] text-primary">lock</span>
            <span className="font-label-sm text-label-sm">بوابة الدفع الآمنة</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-lg">
        <CheckoutStepper current={3} />

        {timeLeft !== null && timeLeft > 0 && (
          <div className="flex justify-center mb-md">
            <div className={`flex items-center gap-xs font-label-md text-label-md font-bold px-md py-2 rounded-full border ${timeLeft < 120 ? "text-error bg-error-container/30 border-error/30" : "text-tertiary bg-tertiary-container/10 border-tertiary/20"}`}>
              <span className="material-symbols-outlined !text-[18px]">timer</span>
              <span>تبقّى {formatTime()} لإكمال الدفع بهذا السعر</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg items-start">
          {/* Payment iframe */}
          <section className="md:col-span-2 space-y-md">
            {statusMessage && (
              <div className="bg-secondary-container/50 border border-primary/30 rounded-xl p-md flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
                <p className="font-body-md text-body-md text-on-surface">{statusMessage}</p>
              </div>
            )}

            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="px-md py-sm border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary">credit_card</span>
                  <h2 className="font-title-md text-title-md font-bold">الدفع بالبطاقة البنكية</h2>
                </div>
                <div className="flex items-center gap-xs text-on-surface-variant">
                  <span className="material-symbols-outlined !text-[16px]">verified_user</span>
                  <span className="font-label-sm text-label-sm">تشفير SSL 256-بت</span>
                </div>
              </div>

              {paymentIntent?.iframe_url ? (
                <iframe
                  src={paymentIntent.iframe_url}
                  className="w-full h-[650px] border-0 bg-white"
                  title="Paymob Secure Checkout"
                />
              ) : (
                <div className="py-xl flex flex-col items-center justify-center text-center gap-base p-md">
                  <span className="material-symbols-outlined text-5xl text-tertiary">warning</span>
                  <p className="font-body-lg text-body-lg text-on-surface">تعذّر تهيئة بوابة الدفع، يرجى المحاولة لاحقاً.</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-primary text-on-primary px-lg py-2.5 rounded-xl font-label-md text-label-md font-bold cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}
            </div>

            <p className="font-label-sm text-label-sm text-on-surface-variant text-center">
              تتم معالجة الدفع بواسطة Paymob — لا نقوم بتخزين بيانات بطاقتك على خوادمنا مطلقاً.
            </p>
          </section>

          {/* Summary */}
          <aside className="md:col-span-1">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-md shadow-sm sticky top-20 space-y-md">
              <h2 className="font-title-md text-title-md font-bold border-b border-outline-variant pb-sm">تفاصيل الحجز</h2>

              {booking?.snapshot && (
                <div className="space-y-sm border-b border-outline-variant/60 pb-md">
                  <div className="flex items-center gap-xs font-label-md text-label-md font-bold text-on-surface">
                    <span className="material-symbols-outlined text-primary !text-[18px]">flight_takeoff</span>
                    <span>{booking.snapshot.owner_airline_name}</span>
                  </div>
                  {booking.snapshot.slices.map((slice, i) => (
                    <div key={i} className="text-on-surface-variant space-y-0.5 pr-6">
                      <p className="font-label-md text-label-md font-bold text-on-surface">
                        {getAirportLabel(slice.origin)} ← {getAirportLabel(slice.destination)}
                      </p>
                      <p className="font-label-sm text-label-sm">
                        {formatFlightTime(slice.segments[0].departing_at.local)} · {formatIsoDuration(slice.duration)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {booking?.passengers && booking.passengers.length > 0 && (
                <div className="space-y-xs border-b border-outline-variant/60 pb-md">
                  <p className="font-label-md text-label-md font-bold text-on-surface flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary !text-[18px]">group</span>
                    <span>المسافرون ({booking.passengers.length})</span>
                  </p>
                  {booking.passengers.map((p, index) => (
                    <p key={p.id} className="pr-6 font-label-sm text-label-sm text-on-surface-variant">
                      {index + 1}. {p.given_name} {p.family_name}
                    </p>
                  ))}
                </div>
              )}

              {booking && (
                <>
                  <div className="space-y-xs border-b border-outline-variant/60 pb-md">
                    <div className="flex justify-between font-label-md text-label-md text-on-surface-variant">
                      <span>سعر التذكرة الأساسي</span>
                      <span>{formatMoney(booking.base_amount, booking.currency)}</span>
                    </div>
                    <div className="flex justify-between font-label-md text-label-md text-on-surface-variant">
                      <span>رسوم الخدمة والضرائب</span>
                      <span>{formatMoney(booking.markup_amount, booking.currency)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-title-md text-title-md font-bold">الإجمالي الكلي</span>
                    <span className="font-headline-md text-headline-md text-primary font-extrabold">
                      {formatMoney(booking.total_amount, booking.currency)}
                    </span>
                  </div>
                  {booking.currency !== "EGP" && (
                    <p className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low rounded-lg p-sm flex items-start gap-xs">
                      <span className="material-symbols-outlined !text-[16px] mt-0.5">info</span>
                      <span>قد يظهر المبلغ داخل بوابة الدفع بالجنيه المصري (EGP) حسب مزوّد الدفع، بقيمة معادلة للإجمالي أعلاه.</span>
                    </p>
                  )}
                </>
              )}

              <div className="flex items-center justify-center gap-xs text-on-surface-variant pt-xs">
                <span className="material-symbols-outlined !text-[14px]">verified_user</span>
                <span className="font-label-sm text-label-sm">جميع المعاملات مشفرة ومحمية</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function SecurePaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        </div>
      }
    >
      <PaymentInner />
    </Suspense>
  );
}
