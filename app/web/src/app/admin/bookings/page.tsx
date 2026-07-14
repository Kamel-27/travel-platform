"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney, decimalsForCurrency } from "@/lib/money";
import { formatSystemTimestamp } from "@/lib/datetime";
import type { AdminBooking, AdminListMeta, BookingStatus, RefundStatus } from "@/lib/types";
import { BookingStatusBadge, EmptyState, ErrorBox, LoadingState, Pager } from "../ui";

const PAGE_SIZE = 20;

const STATUS_FILTERS: { value: BookingStatus | ""; label: string }[] = [
  { value: "", label: "كل الحالات" },
  { value: "confirmed", label: "مؤكد" },
  { value: "paid", label: "مدفوع (قيد التأكيد)" },
  { value: "awaiting_payment", label: "بانتظار الدفع" },
  { value: "cancelled", label: "ملغي" },
  { value: "refunded", label: "مسترد" },
  { value: "order_failed", label: "فشل إصدار الحجز" },
  { value: "failed", label: "فشل" },
  { value: "pending", label: "قيد الإنشاء" },
];

interface CancelResult {
  refund: { id: string; status: RefundStatus } | null;
  customer_receives: { amount: number; currency: string };
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [meta, setMeta] = useState<AdminListMeta>({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [reference, setReference] = useState("");
  const [onlyCancellationRequests, setOnlyCancellationRequests] = useState(false);
  const [offset, setOffset] = useState(0);

  // Cancel action state
  const [cancelling, setCancelling] = useState<AdminBooking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  // Manual refund action state
  const [refunding, setRefunding] = useState<AdminBooking | null>(null);
  const [refundAmountMajor, setRefundAmountMajor] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // No setState before the first await — the set-state-in-effect lint rule
  // forbids synchronous state writes in effect-invoked callbacks. `loading`
  // starts true and only covers the initial fetch; refetches keep showing
  // the previous list.
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (status) params.set("status", status);
      if (reference.trim()) params.set("reference", reference.trim());
      if (onlyCancellationRequests) params.set("cancellation_requested", "true");
      const res = await api.get<{ bookings: AdminBooking[] } & AdminListMeta>(`/admin/bookings?${params}`);
      setBookings(res.bookings);
      setMeta({ total: res.total, limit: res.limit, offset: res.offset });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل الحجوزات.");
    } finally {
      setLoading(false);
    }
  }, [status, reference, onlyCancellationRequests, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelling) return;
    setActionBusy(true);
    setActionErr(null);
    try {
      const result = await api.post<CancelResult>(`/admin/bookings/${cancelling.id}/cancel`, {
        reason: cancelReason.trim() || undefined,
      });
      // Mirror what the API actually did — the refund is queued, not settled.
      setActionMsg(
        result.refund
          ? `تم إلغاء الحجز وإنشاء استرداد بقيمة ${formatMoney(result.customer_receives.amount, result.customer_receives.currency)} (قيد التنفيذ — تابعه في صفحة الاستردادات).`
          : "تم إلغاء الحجز. لم يتم إنشاء استرداد (لا يوجد مبلغ قابل للاسترداد)."
      );
      setCancelling(null);
      setCancelReason("");
      void load();
    } catch (err) {
      setActionErr(err instanceof ApiError ? err.message : "فشل إلغاء الحجز.");
    } finally {
      setActionBusy(false);
    }
  };

  const submitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refunding?.payment_id) return;
    const decimals = decimalsForCurrency(refunding.currency);
    const amountMinor = Math.round(parseFloat(refundAmountMajor) * Math.pow(10, decimals));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setActionErr("أدخل مبلغاً صحيحاً أكبر من صفر.");
      return;
    }
    setActionBusy(true);
    setActionErr(null);
    try {
      const result = await api.post<{ status: RefundStatus; amount: number; currency: string }>(
        `/admin/payments/${refunding.payment_id}/refund`,
        { amount: amountMinor, reason: refundReason.trim() || undefined }
      );
      setActionMsg(
        `تم تنفيذ الاسترداد اليدوي بقيمة ${formatMoney(result.amount, result.currency)} — الحالة: ${result.status === "succeeded" ? "ناجح" : result.status}.`
      );
      setRefunding(null);
      setRefundAmountMajor("");
      setRefundReason("");
      void load();
    } catch (err) {
      setActionErr(err instanceof ApiError ? err.message : "فشل تنفيذ الاسترداد — راجع صفحة الاستردادات، قد يكون السجل قابلاً لإعادة المحاولة.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">الحجوزات</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        كل حجوزات النظام. إلغاء حجز مؤكد ينشئ استرداداً تلقائياً (مبلغ المزوّد + كامل هامش الربح).
      </p>

      {actionMsg && (
        <div className="p-md bg-green-100 dark:bg-green-900/30 border border-green-600 rounded-xl text-green-800 dark:text-green-300 mb-md font-body-md text-body-md flex justify-between items-start gap-md">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="material-symbols-outlined text-[20px]">close</button>
        </div>
      )}
      {error && <ErrorBox message={error} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-base mb-md items-center">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as BookingStatus | ""); setOffset(0); }}
          className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input
          value={reference}
          onChange={(e) => { setReference(e.target.value); setOffset(0); }}
          placeholder="رقم الحجز (PNR)"
          className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface w-44"
        />
        <label className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant cursor-pointer">
          <input
            type="checkbox"
            checked={onlyCancellationRequests}
            onChange={(e) => { setOnlyCancellationRequests(e.target.checked); setOffset(0); }}
            className="rounded"
          />
          طلبات الإلغاء فقط
        </label>
      </div>

      {loading ? (
        <LoadingState label="جاري تحميل الحجوزات..." />
      ) : bookings.length === 0 ? (
        <EmptyState icon="airplane_ticket" label="لا توجد حجوزات مطابقة." />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                  <th className="p-base">رقم الحجز</th>
                  <th className="p-base">المستخدم</th>
                  <th className="p-base">الحالة</th>
                  <th className="p-base">الإجمالي</th>
                  <th className="p-base">تاريخ الإنشاء</th>
                  <th className="p-base">طلب إلغاء</th>
                  <th className="p-base">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-outline-variant/40 font-body-md text-body-md hover:bg-surface-container/40">
                    <td className="p-base font-bold whitespace-nowrap">{b.booking_reference || b.id.slice(0, 8)}</td>
                    <td className="p-base">{b.user_email || b.user_id.slice(0, 8)}</td>
                    <td className="p-base"><BookingStatusBadge status={b.status} /></td>
                    <td className="p-base whitespace-nowrap">{formatMoney(b.total_amount, b.currency)}</td>
                    <td className="p-base whitespace-nowrap text-on-surface-variant">{formatSystemTimestamp(b.created_at)}</td>
                    <td className="p-base">
                      {b.cancellation_requested_at && b.status === "confirmed" ? (
                        <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-sm py-1 rounded-full text-label-sm font-label-sm" title={b.cancellation_request_reason || ""}>
                          بانتظار المراجعة
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="p-base">
                      <div className="flex gap-xs">
                        {b.status === "confirmed" && (
                          <button
                            onClick={() => { setCancelling(b); setActionErr(null); setCancelReason(b.cancellation_request_reason || ""); }}
                            className="bg-error-container/20 text-error px-sm py-xs rounded-lg font-label-sm text-label-sm hover:bg-error-container/40 transition-all"
                          >
                            إلغاء واسترداد
                          </button>
                        )}
                        {b.payment_id && ["cancelled", "order_failed"].includes(b.status) && (
                          <button
                            onClick={() => {
                              setRefunding(b);
                              setActionErr(null);
                              setRefundAmountMajor(String(b.total_amount / Math.pow(10, decimalsForCurrency(b.currency))));
                            }}
                            className="bg-primary/10 text-primary px-sm py-xs rounded-lg font-label-sm text-label-sm hover:bg-primary/20 transition-all"
                          >
                            استرداد يدوي
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={meta.total} limit={meta.limit} offset={offset} onOffsetChange={setOffset} />
        </div>
      )}

      {/* Cancel modal */}
      {cancelling && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <form onSubmit={submitCancel} className="bg-surface-container-lowest rounded-xl p-lg max-w-md w-full shadow-xl space-y-md">
            <h2 className="font-title-lg text-title-lg font-bold text-on-surface">إلغاء الحجز {cancelling.booking_reference || cancelling.id.slice(0, 8)}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              سيتم إلغاء الحجز لدى المزوّد ثم إنشاء استرداد تلقائي للعميل (مبلغ المزوّد + كامل هامش الربح) يُنفَّذ خلال دقائق.
              {cancelling.cancellation_request_reason && (
                <span className="block mt-xs">سبب طلب العميل: «{cancelling.cancellation_request_reason}»</span>
              )}
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="سبب الإلغاء (اختياري)"
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface resize-none"
              rows={2}
            />
            {actionErr && <ErrorBox message={actionErr} />}
            <div className="flex gap-base justify-end">
              <button type="button" onClick={() => setCancelling(null)} disabled={actionBusy} className="px-md py-sm rounded-lg font-label-md text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all">
                تراجع
              </button>
              <button type="submit" disabled={actionBusy} className="px-md py-sm rounded-lg font-label-md text-label-md bg-error text-white hover:brightness-110 disabled:opacity-60 transition-all">
                {actionBusy ? "جاري الإلغاء..." : "تأكيد الإلغاء والاسترداد"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual refund modal */}
      {refunding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <form onSubmit={submitRefund} className="bg-surface-container-lowest rounded-xl p-lg max-w-md w-full shadow-xl space-y-md">
            <h2 className="font-title-lg text-title-lg font-bold text-on-surface">استرداد يدوي — {refunding.booking_reference || refunding.id.slice(0, 8)}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              إجمالي الحجز {formatMoney(refunding.total_amount, refunding.currency)}. لا يمكن أن يتجاوز الاسترداد المبلغ المتبقي القابل للاسترداد (يتحقق منه الخادم).
            </p>
            <label className="block font-label-md text-label-md text-on-surface-variant">
              المبلغ ({refunding.currency})
              <input
                type="number"
                step="any"
                min="0"
                value={refundAmountMajor}
                onChange={(e) => setRefundAmountMajor(e.target.value)}
                className="mt-xs w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface"
                required
              />
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="سبب الاسترداد (اختياري)"
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface resize-none"
              rows={2}
            />
            {actionErr && <ErrorBox message={actionErr} />}
            <div className="flex gap-base justify-end">
              <button type="button" onClick={() => setRefunding(null)} disabled={actionBusy} className="px-md py-sm rounded-lg font-label-md text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all">
                تراجع
              </button>
              <button type="submit" disabled={actionBusy} className="px-md py-sm rounded-lg font-label-md text-label-md bg-primary text-on-primary hover:brightness-110 disabled:opacity-60 transition-all">
                {actionBusy ? "جاري التنفيذ..." : "تنفيذ الاسترداد"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
