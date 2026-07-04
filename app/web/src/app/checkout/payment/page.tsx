"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatIsoDuration } from "@/lib/datetime";
import { getAirportLabel } from "@/lib/airports";
import type { Booking, PaymentIntent } from "@/lib/types";

function PaymentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get("booking_id");

  const [paymentMethod, setPaymentMethod] = useState("credit_card"); // credit_card, apple_pay, wallet
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
      <div className="min-h-screen bg-[#0b1120] text-white flex flex-col items-center justify-center gap-md" dir="rtl">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-title-md">جاري تجهيز بوابة الدفع الآمنة...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-white flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
        <p className="font-title-md text-title-md text-white max-w-md">{error}</p>
        <Link href="/flights" className="mt-md bg-primary hover:bg-primary-container text-white px-md py-sm rounded-lg font-label-md text-label-md">
          العودة للبحث عن رحلات
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white font-sans overflow-x-hidden relative" dir="rtl">
      {/* Decorative Radial Backgrounds */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-tertiary/5 blur-[120px] pointer-events-none z-0"></div>

      <header className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto h-16">
          <Link href="/" className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary-fixed-dim">
            سفريات
          </Link>
          <div className="flex items-center gap-xs font-label-md text-label-md text-orange-400">
            <span className="material-symbols-outlined !text-[18px]">timer</span>
            <span>بوابة الدفع الآمنة</span>
          </div>
        </div>
      </header>

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl relative z-10">
        {/* Secure Header */}
        <div className="flex flex-col items-center mb-lg">
          <div className="bg-primary/20 p-sm rounded-full mb-base border border-primary/40 shadow-[0_0_20px_rgba(0,85,204,0.15)]">
            <span className="material-symbols-outlined text-primary-fixed-dim !text-[32px]">lock</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-white mb-xs text-center">بوابة الدفع الآمنة</h1>
          {timeLeft !== null && timeLeft > 0 && (
            <div className="flex items-center gap-xs font-label-md text-label-md text-orange-400 font-bold bg-orange-400/10 px-md py-sm rounded-full border border-orange-400/20 shadow-sm animate-pulse">
              <span className="material-symbols-outlined !text-[18px]">timer</span>
              <span>تبقي {formatTime()} لإكمال الدفع</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
          {/* Left: Payment Form/Iframe Container */}
          <div className="lg:col-span-8 order-2 lg:order-1">
            {statusMessage && (
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-md mb-md flex items-center gap-base">
                <span className="material-symbols-outlined text-teal-400 animate-spin">progress_activity</span>
                <p className="font-body-md text-teal-400">{statusMessage}</p>
              </div>
            )}

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-md md:p-lg shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              {/* Payment Tabs */}
              <div className="flex flex-wrap gap-base mb-lg">
                <button
                  onClick={() => setPaymentMethod("credit_card")}
                  className={`flex-1 min-w-[140px] flex items-center justify-center gap-sm p-md rounded-xl transition-all font-label-md border-2 font-bold cursor-pointer ${
                    paymentMethod === "credit_card"
                      ? "bg-white text-[#0b1120] border-white"
                      : "bg-white/[0.02] border-white/10 text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined">credit_card</span>
                  <span>بطاقة ائتمانية / مدى</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("apple_pay")}
                  className={`flex-1 min-w-[140px] flex items-center justify-center gap-sm p-md rounded-xl transition-all font-label-md border-2 font-bold cursor-pointer ${
                    paymentMethod === "apple_pay"
                      ? "bg-white text-black border-white"
                      : "bg-white/[0.02] border-white/10 text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined">ios</span>
                  <span>Apple Pay</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("wallet")}
                  className={`flex-1 min-w-[140px] flex items-center justify-center gap-sm p-md rounded-xl transition-all font-label-md border-2 font-bold cursor-pointer ${
                    paymentMethod === "wallet"
                      ? "bg-white text-[#0b1120] border-white"
                      : "bg-white/[0.02] border-white/10 text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  <span>الدفع بالمحفظة</span>
                </button>
              </div>

              {/* Render Payment Method Content */}
              {paymentMethod === "credit_card" && (
                <div className="space-y-md">
                  {paymentIntent?.iframe_url ? (
                    <div className="relative rounded-xl overflow-hidden bg-white border border-white/10 shadow-lg">
                      <iframe
                        src={paymentIntent.iframe_url}
                        className="w-full h-[650px] border-0"
                        title="Paymob Secure Checkout"
                      />
                    </div>
                  ) : (
                    <div className="py-xl flex flex-col items-center justify-center text-center gap-base">
                      <span className="material-symbols-outlined text-5xl text-orange-400">warning</span>
                      <p className="font-body-lg text-white/80">فشل تهيئة بوابة الدفع Paymob. يرجى المحاولة لاحقاً.</p>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "apple_pay" && (
                <div className="py-xl flex flex-col items-center justify-center gap-md">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-black shadow-lg">
                    <span className="material-symbols-outlined text-4xl">ios</span>
                  </div>
                  <p className="font-body-lg text-body-lg text-center text-white/80">ادفع بلمسة واحدة باستخدام Apple Pay بأمان تام</p>
                  <button
                    disabled
                    className="bg-white/20 text-white/60 cursor-not-allowed font-bold font-title-lg px-xl py-md rounded-xl shadow-md flex items-center gap-xs"
                  >
                    <span>غير متوفر حالياً</span>
                  </button>
                </div>
              )}

              {paymentMethod === "wallet" && (
                <div className="py-xl flex flex-col items-center justify-center gap-md">
                  <div className="w-20 h-20 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.1)]">
                    <span className="material-symbols-outlined text-4xl">account_balance_wallet</span>
                  </div>
                  <div className="text-center">
                    <p className="font-body-lg text-body-lg text-white/80">رصيد محفظتك الرقمية الحالي غير كافٍ للدفع.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Trusted Badges */}
            <div className="mt-lg flex flex-wrap justify-center gap-xl opacity-60 hover:opacity-100 transition-opacity duration-300">
              <span className="font-label-sm text-label-sm text-white/40 block w-full text-center mb-xs">نحن نقبل وسائل الدفع الآمنة التالية:</span>
              <img alt="Mada" className="h-8 object-contain bg-white/5 p-1 rounded border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGdmBBcn4FH0n5-kbQ3gTzYctyPMvh-dRZGxnGekg_55xvuKoYO8LhbgmTHTkskr15ulzASzZ3onh0pde0UpCMgNoVdjjYtJldZDGD-tiRiXGYXNNy6zNhLd8taAw2yQ4mH2ath0kaW7m29C5HpZ0sWG9wf5SL4ABnowlsWpjh-5lUl37gdrqEiSENOwzHweCNIZ_z2FHMs84uF17qfdSedSRjnR5KRcaExLLAx6dHwP1PDtVz_o4JggEspEEQ3kIyGC9yrnfpTfWj" />
              <img alt="Visa" className="h-8 object-contain bg-white/5 p-1 rounded border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCl4QjnGied3_oQ4Qr0DmJqamx-BUrkRn94c2XPKZdZa-KaGHn829apK4FFDiZ2agW81Lq2gNf33umzPTewwMIFxKs-xqynp9628sWLGbc151ozWkc_gZ5hDM_pnmXr4ptLIUVOSANP6dgGHsVEIJqT7Ob0hWydGFAaB-kLiYMOjOgBBymHjI5TU6Jh8B36Y39ZoNMmvyJHpdPTL4P7XWFzpTmNQsmfcaNusVn-Px_ITJZHQ4cqY-sScj5-CIE5wHqmh5ZXe6-LBzX0" />
              <img alt="Mastercard" className="h-8 object-contain bg-white/5 p-1 rounded border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfz7XNwx-fH1QJEntBlu_jJP98rkSxlWKyXiSDHXP2JmUYs60FbiZBQ48Ef0v0VcijjZVUMIHu1JEbAI6b0kfLr3MEbM21cmseQQkY2vmZISJ9pq8_ENW6rz7b3doEqVn8hqNDC8BhVNiGUCzRbW1lBuaPfj-iRpsDM0YDvMXJIdUMR8RayjcJlK89qjlH9sI1aLdYfP1GWpEfozqIxD1cJm0Y81kydM2PrgLiiIPvpVUfGRxefQvZa1suWZ_qg6SNWn3oBinfFQGd" />
            </div>
          </div>

          {/* Right: Summary Panel */}
          <div className="lg:col-span-4 order-1 lg:order-2">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-md md:p-lg shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] sticky top-24 space-y-md">
              <h2 className="font-title-lg text-title-lg text-white font-bold border-b border-white/10 pb-sm">تفاصيل الحجز</h2>
              
              {booking?.snapshot && (
                <div className="space-y-sm text-sm border-b border-white/10 pb-md">
                  <div className="flex items-center gap-xs font-bold text-white">
                    <span className="material-symbols-outlined text-primary text-lg">flight_takeoff</span>
                    <span>{booking.snapshot.owner_airline_name}</span>
                  </div>
                  {booking.snapshot.slices.map((slice, i) => (
                    <div key={i} className="text-white/70 space-y-[2px] pl-5">
                      <p className="font-bold">{getAirportLabel(slice.origin)} ← {getAirportLabel(slice.destination)}</p>
                      <p className="text-xs text-white/50">{formatFlightTime(slice.segments[0].departing_at.local)} · {formatIsoDuration(slice.duration)}</p>
                    </div>
                  ))}
                </div>
              )}

              {booking?.passengers && booking.passengers.length > 0 && (
                <div className="space-y-xs text-sm border-b border-white/10 pb-md text-white/70">
                  <p className="font-bold text-white mb-xs flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary text-lg">people</span>
                    <span>المسافرين ({booking.passengers.length})</span>
                  </p>
                  {booking.passengers.map((p, index) => (
                    <p key={p.id} className="pl-5 text-xs">
                      {index + 1}. {p.given_name} {p.family_name} ({p.type === "adult" ? "بالغ" : p.type === "child" ? "طفل" : "رضيع"})
                    </p>
                  ))}
                </div>
              )}

              {booking && (
                <div className="space-y-sm pb-md border-b border-white/10">
                  <div className="flex justify-between font-body-md text-body-md text-white/70">
                    <span>سعر التذكرة الأساسي</span>
                    <span>{formatMoney(booking.base_amount, booking.currency)}</span>
                  </div>
                  <div className="flex justify-between font-body-md text-body-md text-white/70">
                    <span>رسوم الخدمة والضرائب</span>
                    <span>{formatMoney(booking.markup_amount, booking.currency)}</span>
                  </div>
                  <div className="flex justify-between font-body-md text-body-md text-white/70">
                    <span>رسوم الدفع والخدمة الآمنة</span>
                    <span className="text-teal-400">مجاناً</span>
                  </div>
                </div>
              )}

              {booking && (
                <div className="py-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-title-lg text-title-lg text-white font-bold">الإجمالي الكلي</span>
                    <span className="font-headline-md text-headline-md text-orange-400 font-extrabold shadow-orange-400">
                      {formatMoney(booking.total_amount, booking.currency)}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-white/5 rounded-xl p-base flex gap-base items-start border border-white/10">
                <span className="material-symbols-outlined text-teal-400 mt-0.5 shrink-0">info</span>
                <p className="font-label-sm text-label-sm text-white/60">جميع الضرائب والرسوم مشمولة بالكامل في السعر النهائي. لن يتم تطبيق أي رسوم مخفية لاحقاً.</p>
              </div>

              <div className="flex items-center justify-center gap-xs text-white/40 pt-sm">
                <span className="material-symbols-outlined !text-[14px]">verified_user</span>
                <span className="font-label-sm text-label-sm">تشفير وحماية 256-بت SSL</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-lg px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-center gap-base border-t border-white/10 mt-xl opacity-60 text-white">
        <div className="font-headline-md text-headline-md font-extrabold text-primary-fixed-dim">Safariyat</div>
        <div className="flex gap-md">
          <Link className="font-label-sm text-label-sm hover:text-orange-400 transition-colors" href="/">عن سفريات</Link>
          <Link className="font-label-sm text-label-sm hover:text-orange-400 transition-colors" href="/">سياسة الخصوصية</Link>
          <Link className="font-label-sm text-label-sm hover:text-orange-400 transition-colors" href="/support">اتصل بنا</Link>
        </div>
        <div className="font-label-sm text-label-sm text-white/40">© 2026 سفريات. جميع الحقوق محفوظة.</div>
      </footer>
    </div>
  );
}

export default function SecurePaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1120] text-white flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        </div>
      }
    >
      <PaymentInner />
    </Suspense>
  );
}
