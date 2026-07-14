"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminMetrics, DuffelHealth } from "@/lib/types";
import { BookingStatusBadge, ErrorBox, LoadingState, StatCard } from "./ui";
import type { BookingStatus } from "@/lib/types";

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [health, setHealth] = useState<DuffelHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [m, h] = await Promise.all([
          api.get<AdminMetrics>("/admin/metrics"),
          api.get<DuffelHealth>("/admin/health/duffel"),
        ]);
        if (!mounted) return;
        setMetrics(m);
        setHealth(h);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "تعذر تحميل بيانات لوحة التحكم.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <LoadingState label="جاري تحميل لوحة التحكم..." />;

  return (
    <>
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">نظرة عامة</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        مؤشرات النظام المباشرة: الحجوزات، المدفوعات، الاستردادات، وصحة المزوّد.
      </p>

      {error && <ErrorBox message={error} />}

      {metrics && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
            <StatCard icon="airplane_ticket" label="إجمالي الحجوزات" value={metrics.bookings.total} />
            <StatCard
              icon="pending_actions"
              label="طلبات إلغاء بانتظار المراجعة"
              value={metrics.bookings.pending_cancellation_requests}
              tone={metrics.bookings.pending_cancellation_requests > 0 ? "warning" : "default"}
              hint={metrics.bookings.pending_cancellation_requests > 0 ? "تتطلب إجراءً يدوياً في صفحة الحجوزات" : undefined}
            />
            <StatCard
              icon="sync_problem"
              label="استردادات فاشلة"
              value={metrics.refunds.failed_count}
              tone={metrics.refunds.failed_count > 0 ? "error" : "success"}
              hint={metrics.refunds.failed_count > 0 ? "راجع صفحة الاستردادات لإعادة المحاولة" : undefined}
            />
            <StatCard
              icon="group"
              label="المستخدمون النشطون"
              value={`${metrics.users.active} / ${metrics.users.total}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md mb-lg">
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm">
              <h2 className="font-title-md text-title-md font-bold text-on-surface mb-md">الحجوزات حسب الحالة</h2>
              <div className="space-y-sm">
                {Object.entries(metrics.bookings.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <BookingStatusBadge status={status as BookingStatus} />
                    <span className="font-title-md text-title-md font-bold text-on-surface">{count}</span>
                  </div>
                ))}
                {Object.keys(metrics.bookings.by_status).length === 0 && (
                  <p className="font-body-md text-body-md text-on-surface-variant">لا توجد حجوزات بعد.</p>
                )}
              </div>
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm">
              <h2 className="font-title-md text-title-md font-bold text-on-surface mb-md">المدفوعات (لكل عملة)</h2>
              {metrics.payments.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant">لا توجد مدفوعات بعد.</p>
              ) : (
                <table className="w-full text-right">
                  <thead>
                    <tr className="text-on-surface-variant font-label-md text-label-md border-b border-outline-variant">
                      <th className="py-xs">العملة</th>
                      <th className="py-xs">المحصّل</th>
                      <th className="py-xs">المسترد</th>
                      <th className="py-xs">الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.payments.map((p) => (
                      <tr key={p.currency} className="font-body-md text-body-md border-b border-outline-variant/40 last:border-0">
                        <td className="py-sm font-bold">{p.currency}</td>
                        <td className="py-sm">{formatMoney(p.charged_amount, p.currency)}</td>
                        <td className="py-sm text-error">{formatMoney(p.refunded_amount, p.currency)}</td>
                        <td className="py-sm font-bold text-green-700 dark:text-green-400">
                          {formatMoney(p.net_amount, p.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-sm">
                المبالغ حسب عملة الحجز؛ التحصيل الفعلي عبر Paymob يتم بالجنيه المصري في البيئة التجريبية.
              </p>
            </section>
          </div>
        </>
      )}

      {health && (
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm mb-lg">
          <h2 className="font-title-md text-title-md font-bold text-on-surface mb-md">صحة مزوّد الرحلات (Duffel)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
            <StatCard
              icon={health.duffel.configured ? "check_circle" : "error"}
              label="حالة الاتصال"
              value={health.duffel.configured ? "مهيأ" : "غير مهيأ"}
              tone={health.duffel.configured ? "success" : "error"}
            />
            <StatCard
              icon="speed"
              label="نسبة الأخطاء (آخر ساعة)"
              value={`${(health.duffel.recent_error_rate * 100).toFixed(1)}%`}
              tone={health.duffel.recent_error_rate > 0.1 ? "warning" : "default"}
              hint={`${health.duffel.errors_last_hour} من ${health.duffel.requests_last_hour} طلب`}
            />
            <StatCard
              icon="webhook"
              label="أحداث Webhook غير معالجة"
              value={health.webhooks.unprocessed_count}
              tone={health.webhooks.unprocessed_count > 0 ? "warning" : "success"}
            />
            <StatCard
              icon="hourglass_top"
              label="حجوزات عالقة في «مدفوع»"
              value={health.bookings_stuck_in_paid}
              tone={health.bookings_stuck_in_paid > 0 ? "error" : "success"}
            />
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-base">
        <Link
          href="/admin/bookings"
          className="bg-primary text-on-primary px-md py-sm rounded-lg flex items-center gap-xs font-label-md text-label-md hover:brightness-110 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">airplane_ticket</span>
          إدارة الحجوزات
        </Link>
        <Link
          href="/admin/refunds"
          className="bg-surface-container-high text-on-surface px-md py-sm rounded-lg flex items-center gap-xs font-label-md text-label-md hover:bg-surface-container-highest transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">currency_exchange</span>
          متابعة الاستردادات
        </Link>
      </div>
    </>
  );
}
