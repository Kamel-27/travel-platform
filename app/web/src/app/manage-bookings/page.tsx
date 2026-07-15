/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatFlightDate } from "@/lib/datetime";
import { getAirportLabel } from "@/lib/airports";
import type { Booking, CancellationQuote } from "@/lib/types";

export default function ManageBookingsPage() {
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

  const isAdmin = user?.role === "technical_admin";

  const loadBookings = useCallback(async () => {
    try {
      setLoadingBookings(true);
      setBookingsError(null);
      
      const endpoint = isAdmin ? "/admin/bookings" : "/bookings";
      const res = await api.get<any>(endpoint);
      const list = isAdmin ? res.bookings : res.data;
      setBookings(list || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setBookingsError(err.message || "فشل تحميل قائمة الحجوزات.");
      } else {
        setBookingsError("حدث خطأ غير متوقع أثناء تحميل الحجوزات.");
      }
    } finally {
      setLoadingBookings(false);
    }
  }, [isAdmin]);

  // Fetch bookings on mount / auth state change
  useEffect(() => {
    if (isAuthenticated) {
      void loadBookings();
    }
  }, [isAuthenticated, loadBookings]);

  // Fetch cancellation quote (only relevant for regular customers or when evaluating cancellation)
  useEffect(() => {
    if (!cancellingBooking) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    // Admins bypass normal quote display since they override, but let's fetch it defensively
    let isMounted = true;
    setLoadingQuote(true);
    setQuoteError(null);

    const quoteEndpoint = `/bookings/${cancellingBooking.id}/cancellation-quote`;

    api.get<CancellationQuote>(quoteEndpoint)
      .then((data) => {
        if (!isMounted) return;
        setQuote(data);
        setLoadingQuote(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setQuoteError(err.message || "فشل احتساب سياسة استرجاع المبلغ الحالية.");
        } else {
          setQuoteError("حدث خطأ أثناء تحميل سياسة الاسترجاع.");
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
      // Use different endpoint for admin vs regular customer
      const cancelEndpoint = isAdmin 
        ? `/admin/bookings/${cancellingBooking.id}/cancel` 
        : `/bookings/${cancellingBooking.id}/cancel`;

      const result = await api.post<{
        requires_admin?: boolean;
        message?: string;
        refund?: { id: string; status: string } | null;
        customer_receives?: { amount: number; currency: string };
      }>(
        cancelEndpoint,
        { reason: cancelReason }
      );

      // The refund is executed asynchronously (queued with retries) — never
      // claim the money moved; report what the API actually did.
      if (result.requires_admin) {
        setCancelSuccessMsg(result.message || "تم تقديم طلب الإلغاء للمراجعة اليدوية بنجاح.");
      } else if (result.refund) {
        setCancelSuccessMsg("تم إلغاء الحجز وجارٍ تنفيذ عملية الاسترداد — ستُرد المبالغ خلال دقائق.");
      } else {
        setCancelSuccessMsg("تم إلغاء الحجز. لا يوجد مبلغ قابل للاسترداد لهذا الحجز.");
      }

      // Reload list to update statuses
      void loadBookings();

      setTimeout(() => {
        setCancellingBooking(null);
        setCancelSuccessMsg(null);
      }, 3000);

    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setQuoteError(err.message || "فشل إرسال طلب إلغاء الحجز.");
      } else {
        setQuoteError("حدث خطأ أثناء إلغاء الحجز.");
      }
    } finally {
      setSubmittingCancel(false);
    }
  };

  const getStatusBadge = (status: Booking["status"]) => {
    switch (status) {
      case "confirmed":
        return <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-sm py-1 rounded-full text-label-sm font-label-sm">مؤكد</span>;
      case "awaiting_payment":
        return <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-sm py-1 rounded-full text-label-sm font-label-sm">بانتظار الدفع</span>;
      case "paid":
        return <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400 px-sm py-1 rounded-full text-label-sm font-label-sm">مدفوع (قيد التأكيد)</span>;
      case "cancelled":
      case "refunded":
        return <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-400 px-sm py-1 rounded-full text-label-sm font-label-sm">تم الإلغاء</span>;
      case "failed":
      case "order_failed":
        return <span className="bg-error-container/20 text-error px-sm py-1 rounded-full text-label-sm font-label-sm">فشل</span>;
      default:
        return <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-400 px-sm py-1 rounded-full text-label-sm font-label-sm">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-md" dir="rtl">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-title-md">جاري تحميل قائمة الرحلات...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-outline text-5xl">lock</span>
        <p className="font-title-md">يرجى تسجيل الدخول للوصول إلى رحلاتك وحجوزاتك.</p>
        <Link href="/signin" className="mt-md bg-primary text-on-primary px-lg py-md rounded-xl font-bold font-title-lg shadow-md hover:opacity-90 active:scale-95 transition-all">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-16">
          <div className="flex items-center gap-md">
            <Link href="/" className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary hover:opacity-90 transition-opacity">
              سفريات
            </Link>
            <nav className="hidden md:flex gap-md mt-1">
              <Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/">
                رحلات طيران
              </Link>
              <Link className="text-primary dark:text-inverse-primary font-bold border-b-2 border-primary dark:border-inverse-primary pb-1 font-label-md text-label-md" href="/manage-bookings">
                رحلاتي
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-sm">
            <span className="font-label-md text-label-md text-on-surface-variant hidden md:block">
              {isAdmin ? `${user?.full_name} (مسؤول النظام)` : user?.full_name || user?.email}
            </span>
            <button
              onClick={() => logout()}
              className="bg-surface-container-high text-on-surface px-md py-xs rounded-lg font-label-md text-label-md hover:bg-surface-container-highest transition-all"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-lg" dir="rtl">
        <div className="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-md">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary font-bold">
              {isAdmin ? "إدارة الحجوزات (لوحة الإشراف)" : "رحلاتي وحجوزاتي"}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {isAdmin 
                ? "مرحباً بك، تدرج أدناه كافة حجوزات النظام لإدارتها والموافقة على عمليات الاسترداد." 
                : "تجد أدناه تفاصيل كافة الحجوزات والرحلات التي قمت بها معنا."}
            </p>
          </div>
          {!isAdmin && (
            <div className="flex gap-base">
              <Link href="/" className="bg-primary text-on-primary px-md py-sm rounded-lg flex items-center gap-xs font-label-md text-label-md hover:brightness-110 transition-all active:scale-95">
                <span className="material-symbols-outlined">add</span>
                <span>إضافة حجز جديد</span>
              </Link>
            </div>
          )}
        </div>

        {loadingBookings ? (
          <div className="p-xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
            <p className="mt-xs">جاري تحميل قائمة الحجوزات...</p>
          </div>
        ) : bookingsError ? (
          <div className="p-md bg-error-container/20 border border-error rounded-xl text-error mb-md">
            {bookingsError}
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-xl bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl text-outline mb-sm">airplane_ticket</span>
            <p className="font-body-lg">لا توجد أي حجوزات مسجلة.</p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant">
                    <th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">رقم الحجز</th>
                    {isAdmin && <th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">العميل (ID)</th>}
                    <th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">مسار الرحلة</th>
                    <th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">الشركة الناقلة</th>
                    <th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">تاريخ السفر</th>
                    <th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">المبلغ</th>
                    <th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">الحالة</th>
                    <th className="px-md py-md font-label-md text-label-md border-b border-outline-variant text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="px-md py-md font-label-md text-label-md font-bold text-primary font-mono select-all">
                        #{b.booking_reference || b.id.substring(0, 8).toUpperCase()}
                      </td>
                      {isAdmin && (
                        <td className="px-md py-md font-body-sm text-xs font-mono text-white/50 max-w-[120px] truncate" title={(b as any).user_email || (b as any).user_id}>
                          {(b as any).user_email || (b as any).user_id || "N/A"}
                        </td>
                      )}
                      <td className="px-md py-md font-body-md text-body-md font-bold">
                        {b.snapshot?.slices[0] 
                          ? `${getAirportLabel(b.snapshot.slices[0].origin)} ← ${getAirportLabel(b.snapshot.slices[0].destination)}`
                          : "رحلة طيران"}
                      </td>
                      <td className="px-md py-md font-body-md text-body-md">
                        {b.snapshot?.owner_airline_name || "مجهول"}
                      </td>
                      <td className="px-md py-md font-body-md text-body-md text-xs">
                        {b.snapshot?.slices[0]?.segments[0]?.departing_at.local
                          ? formatFlightDate(b.snapshot.slices[0].segments[0].departing_at.local)
                          : "مستقبلي"}
                      </td>
                      <td className="px-md py-md font-label-md text-label-md font-bold">
                        {formatMoney(b.total_amount, b.currency)}
                      </td>
                      <td className="px-md py-md">
                        {getStatusBadge(b.status)}
                      </td>
                      <td className="px-md py-md">
                        <div className="flex justify-center gap-xs">
                          {b.status === "awaiting_payment" && (
                            <Link 
                              href={`/checkout/payment?booking_id=${b.id}`}
                              className="text-xs bg-orange-400 hover:bg-orange-500 text-on-tertiary-fixed font-bold px-md py-[6px] rounded-lg shadow-sm"
                            >
                              إكمال الدفع
                            </Link>
                          )}
                          {b.status === "confirmed" && (
                            <button 
                              onClick={() => setCancellingBooking(b)}
                              className="text-xs text-error hover:bg-error-container/20 border border-error px-md py-[4px] rounded-lg font-bold bg-transparent cursor-pointer"
                              title="إلغاء واسترجاع"
                            >
                              إلغاء حجز
                            </button>
                          )}
                          <Link 
                            href={`/checkout/confirmation?booking_id=${b.id}`}
                            className="p-xs hover:text-primary transition-colors text-xs flex items-center justify-center border border-white/10 hover:border-primary/50 px-sm py-[4px] rounded-lg"
                            title="عرض تفاصيل التذكرة"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

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

                  {!isAdmin && quote.requires_admin && (
                    <div className="bg-orange-500/10 border border-orange-500/20 text-orange-600 p-md rounded-xl text-xs leading-relaxed flex gap-base items-start">
                      <span className="material-symbols-outlined shrink-0 mt-0.5">info</span>
                      <p>
                        <strong>ملاحظة هامة:</strong> هذا الحجز يتطلب مراجعة يدوية من قبل الدعم الفني لإكمال عملية الاسترجاع. سيتم تسجيل طلبك ومراجعته خلال 24 ساعة.
                      </p>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="bg-primary/10 border border-primary/20 text-primary-fixed-dim p-md rounded-xl text-xs leading-relaxed flex gap-base items-start">
                      <span className="material-symbols-outlined shrink-0 mt-0.5">admin_panel_settings</span>
                      <p>
                        <strong>إدارة المشرف:</strong> بصفتك مسؤول نظام، سيتم إلغاء الحجز مباشرة وتجاوز المتطلبات تلقائياً عبر بوابة الدفع.
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
