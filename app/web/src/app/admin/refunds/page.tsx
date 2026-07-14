"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatSystemTimestamp } from "@/lib/datetime";
import type { AdminListMeta, AdminRefund, RefundStatus } from "@/lib/types";
import { EmptyState, ErrorBox, LoadingState, Pager, RefundStatusBadge } from "../ui";

const PAGE_SIZE = 20;

const STATUS_FILTERS: { value: RefundStatus | ""; label: string }[] = [
  { value: "", label: "كل الحالات" },
  { value: "failed", label: "فشل (بحاجة لإعادة محاولة)" },
  { value: "pending", label: "قيد التنفيذ" },
  { value: "succeeded", label: "تم الاسترداد" },
];

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [meta, setMeta] = useState<AdminListMeta>({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RefundStatus | "">("");
  const [offset, setOffset] = useState(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (status) params.set("status", status);
      const res = await api.get<{ refunds: AdminRefund[] } & AdminListMeta>(`/admin/refunds?${params}`);
      setRefunds(res.refunds);
      setMeta({ total: res.total, limit: res.limit, offset: res.offset });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل الاستردادات.");
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (refund: AdminRefund) => {
    setRetryingId(refund.id);
    setActionMsg(null);
    try {
      await api.post(`/admin/refunds/${refund.id}/retry`);
      setActionMsg(
        `تمت إعادة جدولة الاسترداد ${formatMoney(refund.amount, refund.currency)} — سيُنفَّذ خلال دقائق (حدّث الصفحة لمتابعة الحالة).`
      );
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشلت إعادة المحاولة.");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <>
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">الاستردادات</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        خط تنفيذ الاستردادات: السجلات «قيد التنفيذ» تُنفَّذ تلقائياً مع إعادة محاولات؛ السجلات «الفاشلة» تحتاج إعادة محاولة يدوية من هنا.
      </p>

      {actionMsg && (
        <div className="p-md bg-green-100 dark:bg-green-900/30 border border-green-600 rounded-xl text-green-800 dark:text-green-300 mb-md font-body-md text-body-md flex justify-between items-start gap-md">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="material-symbols-outlined text-[20px]">close</button>
        </div>
      )}
      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap gap-base mb-md items-center">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as RefundStatus | ""); setOffset(0); }}
          className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button
          onClick={() => void load()}
          className="bg-surface-container-high text-on-surface px-md py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container-highest transition-all flex items-center gap-xs"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          تحديث
        </button>
      </div>

      {loading ? (
        <LoadingState label="جاري تحميل الاستردادات..." />
      ) : refunds.length === 0 ? (
        <EmptyState icon="currency_exchange" label="لا توجد استردادات مطابقة." />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                  <th className="p-base">الحجز</th>
                  <th className="p-base">المبلغ</th>
                  <th className="p-base">الحالة</th>
                  <th className="p-base">السبب</th>
                  <th className="p-base">مرجع البوابة</th>
                  <th className="p-base">آخر تحديث</th>
                  <th className="p-base">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id} className="border-t border-outline-variant/40 font-body-md text-body-md hover:bg-surface-container/40">
                    <td className="p-base font-bold whitespace-nowrap">{r.booking_reference || r.booking_id?.slice(0, 8) || "—"}</td>
                    <td className="p-base whitespace-nowrap">
                      {formatMoney(r.amount, r.currency)}
                      {r.supplier_refund_amount !== null && (
                        <span className="block font-label-sm text-label-sm text-on-surface-variant">
                          من المزوّد: {formatMoney(r.supplier_refund_amount, r.currency)}
                        </span>
                      )}
                    </td>
                    <td className="p-base"><RefundStatusBadge status={r.status} /></td>
                    <td className="p-base text-on-surface-variant max-w-48 truncate" title={r.reason || ""}>{r.reason || "—"}</td>
                    <td className="p-base text-on-surface-variant font-mono text-label-sm">{r.provider_refund_id || "—"}</td>
                    <td className="p-base whitespace-nowrap text-on-surface-variant">{formatSystemTimestamp(r.updated_at)}</td>
                    <td className="p-base">
                      {r.status === "failed" && (
                        <button
                          onClick={() => void retry(r)}
                          disabled={retryingId === r.id}
                          className="bg-primary/10 text-primary px-sm py-xs rounded-lg font-label-sm text-label-sm hover:bg-primary/20 disabled:opacity-60 transition-all flex items-center gap-xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">replay</span>
                          {retryingId === r.id ? "جاري..." : "إعادة المحاولة"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={meta.total} limit={meta.limit} offset={offset} onOffsetChange={setOffset} />
        </div>
      )}
    </>
  );
}
