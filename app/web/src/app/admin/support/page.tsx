"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { formatSystemTimestamp } from "@/lib/datetime";
import type { AdminListMeta, AdminSupportTicket, SupportTicketStatus } from "@/lib/types";
import { EmptyState, ErrorBox, LoadingState, Pager } from "../ui";

const PAGE_SIZE = 20;

const STATUS_FILTERS: { value: SupportTicketStatus | ""; label: string }[] = [
  { value: "", label: "كل الحالات" },
  { value: "open", label: "مفتوحة" },
  { value: "in_progress", label: "قيد المعالجة" },
  { value: "resolved", label: "تم الحل" },
];

const TYPE_LABELS: Record<string, string> = {
  cancellation: "إلغاء حجز",
  flight_delay: "تأخير رحلة",
  name_change: "تعديل اسم مسافر",
  refund: "استرداد مبلغ",
  other: "أخرى",
};

const STATUS_BADGES: Record<SupportTicketStatus, { label: string; cls: string }> = {
  open: { label: "مفتوحة", cls: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400" },
  in_progress: { label: "قيد المعالجة", cls: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400" },
  resolved: { label: "تم الحل", cls: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400" },
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [meta, setMeta] = useState<AdminListMeta>({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<SupportTicketStatus | "">("");
  const [offset, setOffset] = useState(0);

  // Update modal state
  const [editing, setEditing] = useState<AdminSupportTicket | null>(null);
  const [newStatus, setNewStatus] = useState<SupportTicketStatus>("in_progress");
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (status) params.set("status", status);
      const res = await api.get<{ tickets: AdminSupportTicket[] } & AdminListMeta>(
        `/admin/support/tickets?${params}`
      );
      setTickets(res.tickets);
      setMeta({ total: res.total, limit: res.limit, offset: res.offset });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل تذاكر الدعم.");
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const openEditor = (t: AdminSupportTicket) => {
    setEditing(t);
    setNewStatus(t.status === "open" ? "in_progress" : t.status);
    setAdminNote(t.admin_note ?? "");
    setActionErr(null);
  };

  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setActionErr(null);
    try {
      await api.patch(`/admin/support/tickets/${editing.id}`, {
        status: newStatus,
        admin_note: adminNote.trim() || undefined,
      });
      setActionMsg(`تم تحديث التذكرة (${STATUS_BADGES[newStatus].label}).`);
      setEditing(null);
      void load();
    } catch (err) {
      setActionErr(err instanceof ApiError ? err.message : "فشل تحديث التذكرة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">تذاكر الدعم</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        طلبات العملاء الواردة من صفحة الدعم. تحديث الحالة أو إضافة رد يُسجَّل في سجل التدقيق ويظهر الرد للعميل.
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
          onChange={(e) => { setStatus(e.target.value as SupportTicketStatus | ""); setOffset(0); }}
          className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState label="جاري تحميل تذاكر الدعم..." />
      ) : tickets.length === 0 ? (
        <EmptyState icon="support_agent" label="لا توجد تذاكر مطابقة." />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                  <th className="p-base">النوع</th>
                  <th className="p-base">العميل</th>
                  <th className="p-base">رقم الحجز</th>
                  <th className="p-base">الوصف</th>
                  <th className="p-base">الحالة</th>
                  <th className="p-base">تاريخ الإنشاء</th>
                  <th className="p-base">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-t border-outline-variant/40 font-body-md text-body-md hover:bg-surface-container/40 align-top">
                    <td className="p-base whitespace-nowrap font-bold">{TYPE_LABELS[t.type] ?? t.type}</td>
                    <td className="p-base">{t.user_email || t.user_id.slice(0, 8)}</td>
                    <td className="p-base font-mono whitespace-nowrap" dir="ltr">
                      {t.booking_reference ? (
                        <Link
                          href={`/admin/bookings?reference=${encodeURIComponent(t.booking_reference)}`}
                          className="text-primary hover:underline"
                        >
                          {t.booking_reference}
                        </Link>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="p-base max-w-[320px]">
                      <p className="line-clamp-3 whitespace-pre-wrap">{t.description}</p>
                      {t.admin_note && (
                        <p className="mt-xs text-label-sm text-on-surface-variant">
                          <span className="font-bold">الرد:</span> {t.admin_note}
                        </p>
                      )}
                    </td>
                    <td className="p-base">
                      <span className={`px-sm py-1 rounded-full text-label-sm font-label-sm whitespace-nowrap ${STATUS_BADGES[t.status].cls}`}>
                        {STATUS_BADGES[t.status].label}
                      </span>
                    </td>
                    <td className="p-base whitespace-nowrap text-on-surface-variant">{formatSystemTimestamp(t.created_at)}</td>
                    <td className="p-base">
                      <button
                        onClick={() => openEditor(t)}
                        className="bg-primary/10 text-primary px-sm py-xs rounded-lg font-label-sm text-label-sm hover:bg-primary/20 transition-all whitespace-nowrap"
                      >
                        تحديث / رد
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={meta.total} limit={meta.limit} offset={offset} onOffsetChange={setOffset} />
        </div>
      )}

      {/* Update modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <form onSubmit={submitUpdate} className="bg-surface-container-lowest rounded-xl p-lg max-w-md w-full shadow-xl space-y-md">
            <h2 className="font-title-lg text-title-lg font-bold text-on-surface">
              تحديث تذكرة — {TYPE_LABELS[editing.type] ?? editing.type}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-wrap max-h-40 overflow-y-auto bg-surface-container rounded-lg p-md">
              {editing.description}
            </p>
            <label className="block font-label-md text-label-md text-on-surface-variant">
              الحالة الجديدة
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as SupportTicketStatus)}
                className="mt-xs w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface"
              >
                <option value="open">مفتوحة</option>
                <option value="in_progress">قيد المعالجة</option>
                <option value="resolved">تم الحل</option>
              </select>
            </label>
            <label className="block font-label-md text-label-md text-on-surface-variant">
              رد فريق الدعم (يظهر للعميل)
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="مثال: تم تنفيذ الاسترداد، ستصلك الأموال خلال 5-7 أيام عمل."
                className="mt-xs w-full bg-surface-container border border-outline-variant rounded-lg p-md font-body-md text-body-md text-on-surface resize-none"
                rows={3}
              />
            </label>
            {actionErr && <ErrorBox message={actionErr} />}
            <div className="flex gap-base justify-end">
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className="px-md py-sm rounded-lg font-label-md text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all">
                تراجع
              </button>
              <button type="submit" disabled={busy} className="px-md py-sm rounded-lg font-label-md text-label-md bg-primary text-on-primary hover:brightness-110 disabled:opacity-60 transition-all">
                {busy ? "جاري الحفظ..." : "حفظ التحديث"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
