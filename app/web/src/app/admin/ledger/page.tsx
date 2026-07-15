"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney, decimalsForCurrency } from "@/lib/money";
import { formatSystemTimestamp } from "@/lib/datetime";
import type { AdminLedgerEntry, LedgerEntryType, AdminListMeta } from "@/lib/types";
import { EmptyState, ErrorBox, LoadingState, Pager } from "../ui";

const PAGE_SIZE = 20;

const ENTRY_TYPE_LABELS: Record<LedgerEntryType, { label: string; cls: string }> = {
  customer_payment: { label: "دفع عميل", cls: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400" },
  gateway_refund: { label: "استرداد بوابة", cls: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400" },
  supplier_charge: { label: "خصم المزوّد", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400" },
  supplier_refund: { label: "استرداد المزوّد", cls: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400" },
  adjustment: { label: "تعديل يدوي", cls: "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300" },
};

const ENTRY_TYPE_FILTERS: { value: LedgerEntryType | ""; label: string }[] = [
  { value: "", label: "كل أنواع الحركات" },
  { value: "customer_payment", label: "دفع عميل" },
  { value: "gateway_refund", label: "استرداد بوابة" },
  { value: "supplier_charge", label: "خصم المزوّد" },
  { value: "supplier_refund", label: "استرداد المزوّد" },
  { value: "adjustment", label: "تعديل يدوي" },
];

interface LedgerSummary {
  currency: string;
  net_position: number;
  duffel_wallet_estimate: number;
}

export default function AdminLedgerPage() {
  const [entries, setEntries] = useState<AdminLedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary[]>([]);
  const [meta, setMeta] = useState<AdminListMeta>({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [entryType, setEntryType] = useState<LedgerEntryType | "">("");
  const [currency, setCurrency] = useState("");
  const [bookingId, setBookingId] = useState("");
  // Applied on form submit only, so typing in the booking-id input doesn't refetch per keystroke.
  const [bookingFilter, setBookingFilter] = useState("");
  const [offset, setOffset] = useState(0);

  // Modal State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjAmountMajor, setAdjAmountMajor] = useState("");
  const [adjCurrency, setAdjCurrency] = useState("USD");
  const [adjSupplier, setAdjSupplier] = useState<"duffel" | "">("");
  const [adjBookingId, setAdjBookingId] = useState("");
  const [adjNote, setAdjNote] = useState("");

  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get<LedgerSummary[]>("/admin/ledger/summary");
      setSummary(res);
    } catch (err) {
      console.error("Failed to load ledger summary", err);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (entryType) params.set("entry_type", entryType);
      if (currency) params.set("currency", currency);
      if (bookingFilter) params.set("booking_id", bookingFilter);

      const res = await api.get<{ entries: AdminLedgerEntry[] } & AdminListMeta>(`/admin/ledger?${params}`);
      setEntries(res.entries);
      setMeta({ total: res.total, limit: res.limit, offset: res.offset });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل قيود دفتر الأستاذ.");
    } finally {
      setLoading(false);
    }
  }, [entryType, currency, bookingFilter, offset]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadSummary(), loadEntries()]);
  }, [loadSummary, loadEntries]);

  useEffect(() => {
    void (async () => {
      await loadAll();
    })();
  }, [loadAll]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = bookingId.trim();
    if (next === bookingFilter && offset === 0) return;
    setLoading(true);
    setOffset(0);
    setBookingFilter(next);
  };

  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBusy(true);
    setActionErr(null);
    setActionMsg(null);

    const decimals = decimalsForCurrency(adjCurrency);
    const amountMinor = Math.round(parseFloat(adjAmountMajor) * Math.pow(10, decimals));

    if (Number.isNaN(amountMinor)) {
      setActionErr("أدخل مبلغاً صحيحاً.");
      setActionBusy(false);
      return;
    }

    try {
      await api.post("/admin/ledger/adjustment", {
        amount: amountMinor,
        currency: adjCurrency,
        supplier: adjSupplier || undefined,
        booking_id: adjBookingId.trim() || undefined,
        note: adjNote.trim(),
      });

      setActionMsg("تم تسجيل التعديل اليدوي بنجاح.");
      setShowAdjustmentModal(false);
      // Reset form
      setAdjAmountMajor("");
      setAdjSupplier("");
      setAdjBookingId("");
      setAdjNote("");
      // Reload lists
      setLoading(true);
      setOffset(0);
      void loadAll();
    } catch (err) {
      setActionErr(err instanceof ApiError ? err.message : "فشل تسجيل التعديل اليدوي.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-base mb-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">دفتر الأستاذ (Balance Control)</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            سجل العمليات المالية وتقديرات أرصدة محفظة المزوّد للمطابقة والتسوية اليدوية.
          </p>
        </div>
        <button
          onClick={() => { setShowAdjustmentModal(true); setActionErr(null); }}
          className="bg-primary text-on-primary px-md py-sm rounded-lg flex items-center gap-xs font-label-md text-label-md hover:brightness-110 transition-all active:scale-95 flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          إضافة تعديل يدوي (تسوية)
        </button>
      </div>

      {actionMsg && (
        <div className="p-md bg-green-100 dark:bg-green-900/30 border border-green-600 rounded-xl text-green-800 dark:text-green-300 mb-md font-body-md text-body-md flex justify-between items-start gap-md">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="material-symbols-outlined text-[20px]">close</button>
        </div>
      )}
      {error && <ErrorBox message={error} />}

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md mb-lg">
          {summary.map((sum) => (
            <div key={sum.currency} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm flex flex-col sm:flex-row justify-around items-center gap-md">
              <div className="text-center sm:text-right">
                <p className="font-label-md text-label-md text-on-surface-variant mb-xs">صافي المركز المالي ({sum.currency})</p>
                <p className={`font-headline-md text-headline-md font-bold ${sum.net_position >= 0 ? "text-green-700 dark:text-green-400" : "text-error"}`}>
                  {formatMoney(sum.net_position, sum.currency)}
                </p>
              </div>
              <div className="border-t sm:border-t-0 sm:border-r border-outline-variant w-full sm:w-auto h-0 sm:h-12"></div>
              <div className="text-center sm:text-right">
                <p className="font-label-md text-label-md text-on-surface-variant mb-xs">رصيد محفظة Duffel التقديري ({sum.currency})</p>
                <p className={`font-headline-md text-headline-md font-bold ${sum.duffel_wallet_estimate >= 0 ? "text-primary" : "text-error"}`}>
                  {formatMoney(sum.duffel_wallet_estimate, sum.currency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters Form */}
      <form onSubmit={handleSearch} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm mb-lg flex flex-wrap gap-base items-end">
        <div className="flex flex-col gap-xs min-w-[150px]">
          <label className="font-label-sm text-label-sm text-on-surface-variant">النوع</label>
          <select
            value={entryType}
            onChange={(e) => { setEntryType(e.target.value as LedgerEntryType | ""); setOffset(0); }}
            className="bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface"
          >
            {ENTRY_TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-xs min-w-[120px]">
          <label className="font-label-sm text-label-sm text-on-surface-variant">العملة</label>
          <select
            value={currency}
            onChange={(e) => { setCurrency(e.target.value); setOffset(0); }}
            className="bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface"
          >
            <option value="">كل العملات</option>
            <option value="USD">USD</option>
            <option value="EGP">EGP</option>
          </select>
        </div>

        <div className="flex flex-col gap-xs min-w-[240px] flex-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant">معرف الحجز (UUID)</label>
          <input
            type="text"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="البحث عن طريق معرف الحجز..."
            className="bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface"
          />
        </div>

        <div className="flex gap-xs">
          <button
            type="submit"
            className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md text-label-md hover:brightness-110 transition-all active:scale-95"
          >
            تطبيق
          </button>
          <button
            type="button"
            onClick={() => { setEntryType(""); setCurrency(""); setBookingId(""); setBookingFilter(""); setOffset(0); }}
            className="bg-surface-container-high text-on-surface px-md py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container-highest transition-all"
          >
            إعادة تعيين
          </button>
        </div>
      </form>

      {/* Entries Table */}
      {loading ? (
        <LoadingState label="جاري تحميل سجل دفتر الأستاذ..." />
      ) : entries.length === 0 ? (
        <EmptyState icon="receipt_long" label="لا توجد قيود مطابقة في دفتر الأستاذ." />
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden mb-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md border-b border-outline-variant">
                  <th className="p-md">التاريخ والوقت</th>
                  <th className="p-md">النوع</th>
                  <th className="p-md">المبلغ</th>
                  <th className="p-md">العملة</th>
                  <th className="p-md">المزوّد</th>
                  <th className="p-md">معرف الحجز</th>
                  <th className="p-md">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const badge = ENTRY_TYPE_LABELS[entry.entry_type] ?? { label: entry.entry_type, cls: "" };
                  const isPositive = entry.amount >= 0;
                  return (
                    <tr key={entry.id} className="font-body-md text-body-md border-b border-outline-variant/40 hover:bg-surface-container/20 transition-colors last:border-0">
                      <td className="p-md text-on-surface-variant whitespace-nowrap">
                        {formatSystemTimestamp(entry.created_at)}
                      </td>
                      <td className="p-md">
                        <span className={`px-sm py-1 rounded-full text-label-sm font-label-sm whitespace-nowrap ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className={`p-md font-bold whitespace-nowrap ${isPositive ? "text-green-700 dark:text-green-400" : "text-error"}`}>
                        {isPositive ? "+" : ""}{formatMoney(entry.amount, entry.currency)}
                      </td>
                      <td className="p-md font-bold text-on-surface">{entry.currency}</td>
                      <td className="p-md text-on-surface-variant whitespace-nowrap">
                        {entry.supplier === "duffel" ? (
                          <span className="px-sm py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded text-label-sm font-bold">Duffel</span>
                        ) : entry.supplier || "—"}
                      </td>
                      <td className="p-md font-mono text-label-md text-on-surface-variant whitespace-nowrap">
                        {entry.booking_reference ? (
                          <a
                            href={`/admin/bookings?reference=${entry.booking_reference}`}
                            title={entry.booking_id ?? undefined}
                            className="text-primary hover:underline"
                          >
                            {entry.booking_reference}
                          </a>
                        ) : entry.booking_id ? (
                          <span title={entry.booking_id}>{entry.booking_id.slice(0, 8)}...</span>
                        ) : "—"}
                      </td>
                      <td className="p-md text-on-surface-variant max-w-[250px] truncate" title={entry.note || ""}>
                        {entry.note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager total={meta.total} limit={meta.limit} offset={meta.offset} onOffsetChange={setOffset} />
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <form onSubmit={submitAdjustment} className="bg-surface-container-lowest rounded-xl p-lg max-w-md w-full shadow-xl space-y-md">
            <h2 className="font-title-lg text-title-lg font-bold text-on-surface">إضافة تعديل يدوي (تسوية)</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              تسجيل حركة يدوية لتصحيح أو مطابقة أرصدة دفتر الأستاذ مع كشوفات Paymob أو محفظة Duffel.
            </p>

            <div className="grid grid-cols-2 gap-md">
              <label className="block font-label-md text-label-md text-on-surface-variant">
                المبلغ (بالوحدات الرئيسية)
                <input
                  type="number"
                  step="any"
                  value={adjAmountMajor}
                  onChange={(e) => setAdjAmountMajor(e.target.value)}
                  placeholder="مثال: -150.50 أو 500"
                  className="mt-xs w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface"
                  required
                />
              </label>

              <label className="block font-label-md text-label-md text-on-surface-variant">
                العملة
                <select
                  value={adjCurrency}
                  onChange={(e) => setAdjCurrency(e.target.value)}
                  className="mt-xs w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface"
                  required
                >
                  <option value="USD">USD</option>
                  <option value="EGP">EGP</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <label className="block font-label-md text-label-md text-on-surface-variant">
                المزوّد المستهدف
                <select
                  value={adjSupplier}
                  onChange={(e) => setAdjSupplier(e.target.value as "duffel" | "")}
                  className="mt-xs w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface"
                >
                  <option value="">لا يوجد (بوابة الدفع)</option>
                  <option value="duffel">Duffel (محفظة المزوّد)</option>
                </select>
              </label>

              <label className="block font-label-md text-label-md text-on-surface-variant">
                معرف الحجز (اختياري)
                <input
                  type="text"
                  value={adjBookingId}
                  onChange={(e) => setAdjBookingId(e.target.value)}
                  placeholder="معرف الحجز..."
                  className="mt-xs w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface"
                />
              </label>
            </div>

            <label className="block font-label-md text-label-md text-on-surface-variant">
              البيان والسبب (Notes)
              <textarea
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                placeholder="تفاصيل التسوية وتطابق الحسابات..."
                className="mt-xs w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface resize-none"
                rows={3}
                required
              />
            </label>

            {actionErr && <ErrorBox message={actionErr} />}

            <div className="flex gap-base justify-end">
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                disabled={actionBusy}
                className="px-md py-sm rounded-lg font-label-md text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all"
              >
                تراجع
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="px-md py-sm rounded-lg font-label-md text-label-md bg-primary text-on-primary hover:brightness-110 disabled:opacity-60 transition-all"
              >
                {actionBusy ? "جاري الحفظ..." : "تسجيل التعديل"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
