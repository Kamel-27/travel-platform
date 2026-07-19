"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { Booking, CancellationQuote } from "@/lib/types";

interface CancelBookingModalProps {
  booking: Booking;
  onClose: () => void;
  /** Fired after the cancel/cancel-request API call succeeds so the caller can refresh its data. */
  onCancelled: () => void;
}

/**
 * Customer-facing cancellation flow: fetches the refund quote for the
 * booking, shows penalty/receivable amounts, and submits the cancel
 * request. Shared by the user dashboard and the booking detail page.
 */
export default function CancelBookingModal({ booking, onClose, onCancelled }: CancelBookingModalProps) {
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("customer_cancel");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    api.get<CancellationQuote>(`/bookings/${booking.id}/cancellation-quote`)
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
  }, [booking.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setQuoteError(null);

    try {
      const result = await api.post<{ requires_admin: boolean; message?: string }>(
        `/bookings/${booking.id}/cancel`,
        { reason: cancelReason }
      );

      if (result.requires_admin) {
        setSuccessMsg(result.message || "تم تقديم طلب الإلغاء للمراجعة اليدوية بنجاح.");
      } else {
        setSuccessMsg("تم إلغاء الحجز وجارٍ تنفيذ عملية الاسترداد — ستُرد المبالغ خلال دقائق.");
      }

      onCancelled();
      setTimeout(() => onClose(), 3000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setQuoteError(err.message || "فشل إرسال طلب الإلغاء.");
      } else {
        setQuoteError("حدث خطأ أثناء إلغاء الحجز.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="bg-surface-container-lowest text-on-surface border border-outline-variant rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in-up">
        <header className="p-md border-b border-outline-variant/30 flex justify-between items-center">
          <h3 className="font-title-lg font-bold flex items-center gap-xs">
            <span className="material-symbols-outlined text-red-500">warning</span>
            <span>إلغاء حجز الطيران</span>
          </h3>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface bg-transparent border-0 cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-md space-y-md">
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
                  <span className="font-bold">{formatMoney(booking.total_amount, booking.currency)}</span>
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

          {successMsg && (
            <div className="bg-teal-500/10 border border-teal-500/30 text-teal-600 p-md rounded-xl text-center text-sm font-bold animate-pulse">
              {successMsg}
            </div>
          )}

          <footer className="flex justify-end gap-sm pt-md border-t border-outline-variant/30">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border border-outline-variant hover:bg-surface-container-low text-on-surface font-label-md px-md py-base rounded-lg cursor-pointer"
            >
              تراجع
            </button>
            {quote && !successMsg && (
              <button
                type="submit"
                disabled={submitting || loadingQuote}
                className="bg-red-500 hover:bg-red-600 text-white font-bold font-label-md px-lg py-base rounded-lg shadow-md active:scale-95 transition-all cursor-pointer border-0"
              >
                {submitting ? "جاري الإلغاء..." : "تأكيد إلغاء الحجز"}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
