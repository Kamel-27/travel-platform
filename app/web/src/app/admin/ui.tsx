"use client";

// Shared building blocks for the /admin pages — kept deliberately small so
// each page stays a plain table/form over api_contract.md §7 responses.

import type { BookingStatus, RefundStatus } from "@/lib/types";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="p-xl text-center text-on-surface-variant">
      <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
      <p className="mt-xs font-body-md text-body-md">{label}</p>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-md bg-error-container/20 border border-error rounded-xl text-error mb-md font-body-md text-body-md">
      {message}
    </div>
  );
}

export function EmptyState({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="p-xl bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-center text-on-surface-variant">
      <span className="material-symbols-outlined text-5xl text-outline mb-sm">{icon}</span>
      <p className="font-body-lg text-body-lg">{label}</p>
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  tone = "default",
  hint,
}: {
  icon: string;
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "error";
  hint?: string;
}) {
  const toneClass =
    tone === "error"
      ? "text-error"
      : tone === "warning"
        ? "text-yellow-700 dark:text-yellow-400"
        : tone === "success"
          ? "text-green-700 dark:text-green-400"
          : "text-primary";
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex items-start gap-md shadow-sm">
      <span className={`material-symbols-outlined text-3xl ${toneClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className="font-label-md text-label-md text-on-surface-variant">{label}</p>
        <p className={`font-headline-md text-headline-md font-bold ${toneClass}`}>{value}</p>
        {hint && <p className="font-label-sm text-label-sm text-on-surface-variant mt-xs">{hint}</p>}
      </div>
    </div>
  );
}

const BOOKING_STATUS_LABELS: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: "قيد الإنشاء", cls: "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300" },
  awaiting_payment: { label: "بانتظار الدفع", cls: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400" },
  paid: { label: "مدفوع (قيد التأكيد)", cls: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400" },
  confirmed: { label: "مؤكد", cls: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400" },
  order_failed: { label: "فشل إصدار الحجز", cls: "bg-error-container/20 text-error" },
  cancelled: { label: "ملغي", cls: "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300" },
  failed: { label: "فشل", cls: "bg-error-container/20 text-error" },
  refunded: { label: "مسترد", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const conf = BOOKING_STATUS_LABELS[status] ?? {
    label: status,
    cls: "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300",
  };
  return (
    <span className={`px-sm py-1 rounded-full text-label-sm font-label-sm whitespace-nowrap ${conf.cls}`}>
      {conf.label}
    </span>
  );
}

const REFUND_STATUS_LABELS: Record<RefundStatus, { label: string; cls: string }> = {
  pending: { label: "قيد التنفيذ", cls: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400" },
  succeeded: { label: "تم الاسترداد", cls: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400" },
  failed: { label: "فشل", cls: "bg-error-container/20 text-error" },
};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const conf = REFUND_STATUS_LABELS[status] ?? {
    label: status,
    cls: "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300",
  };
  return (
    <span className={`px-sm py-1 rounded-full text-label-sm font-label-sm whitespace-nowrap ${conf.cls}`}>
      {conf.label}
    </span>
  );
}

/** Simple offset pager for the admin list endpoints ({total, limit, offset}). */
export function Pager({
  total,
  limit,
  offset,
  onOffsetChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between p-base border-t border-outline-variant text-on-surface-variant">
      <button
        disabled={offset === 0}
        onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        className="px-md py-xs rounded-lg font-label-md text-label-md bg-surface-container hover:bg-surface-container-high disabled:opacity-40 transition-all"
      >
        السابق
      </button>
      <span className="font-label-md text-label-md">
        صفحة {page} من {pages} ({total} سجل)
      </span>
      <button
        disabled={offset + limit >= total}
        onClick={() => onOffsetChange(offset + limit)}
        className="px-md py-xs rounded-lg font-label-md text-label-md bg-surface-container hover:bg-surface-container-high disabled:opacity-40 transition-all"
      >
        التالي
      </button>
    </div>
  );
}
