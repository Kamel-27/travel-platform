"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatSystemTimestamp } from "@/lib/datetime";
import type { AdminListMeta, AuditLogEntry } from "@/lib/types";
import { EmptyState, ErrorBox, LoadingState, Pager } from "../ui";

const PAGE_SIZE = 20;

const ENTITY_FILTERS = [
  { value: "", label: "كل الكيانات" },
  { value: "booking", label: "الحجوزات" },
  { value: "payment", label: "المدفوعات" },
  { value: "refund", label: "الاستردادات" },
  { value: "user", label: "المستخدمون" },
  { value: "markup_rule", label: "قواعد هامش الربح" },
];

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<AdminListMeta>({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (entityType) params.set("entity_type", entityType);
      if (entityId.trim()) params.set("entity_id", entityId.trim());
      const res = await api.get<{ audit_logs: AuditLogEntry[] } & AdminListMeta>(`/admin/audit-logs?${params}`);
      setLogs(res.audit_logs);
      setMeta({ total: res.total, limit: res.limit, offset: res.offset });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل سجل التدقيق.");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, offset]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <>
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">سجل التدقيق</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        كل عملية إدارية مسجّلة هنا تلقائياً: من قام بها، وعلى أي كيان، وتفاصيلها — أحدث العمليات أولاً.
      </p>

      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap gap-base mb-md items-center">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setOffset(0); }}
          className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface"
        >
          {ENTITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input
          value={entityId}
          onChange={(e) => { setEntityId(e.target.value); setOffset(0); }}
          placeholder="معرّف الكيان (اختياري)"
          className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface w-72 font-mono"
        />
      </div>

      {loading ? (
        <LoadingState label="جاري تحميل السجل..." />
      ) : logs.length === 0 ? (
        <EmptyState icon="history" label="لا توجد عمليات مسجلة مطابقة." />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                  <th className="p-base">الوقت</th>
                  <th className="p-base">المنفّذ</th>
                  <th className="p-base">العملية</th>
                  <th className="p-base">الكيان</th>
                  <th className="p-base">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-outline-variant/40 font-body-md text-body-md hover:bg-surface-container/40 align-top">
                    <td className="p-base whitespace-nowrap text-on-surface-variant">{formatSystemTimestamp(log.created_at)}</td>
                    <td className="p-base">{log.actor_email || log.actor_user_id.slice(0, 8)}</td>
                    <td className="p-base font-mono text-label-sm font-bold">{log.action}</td>
                    <td className="p-base">
                      <span className="text-on-surface-variant">{log.entity_type}</span>
                      <span className="block font-mono text-label-sm text-on-surface-variant/70" title={log.entity_id}>
                        {log.entity_id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="p-base max-w-96">
                      {log.metadata ? (
                        expandedId === log.id ? (
                          <pre
                            onClick={() => setExpandedId(null)}
                            className="font-mono text-label-sm bg-surface-container rounded-lg p-sm overflow-x-auto cursor-pointer whitespace-pre-wrap break-all"
                            dir="ltr"
                          >
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        ) : (
                          <button
                            onClick={() => setExpandedId(log.id)}
                            className="text-primary font-label-sm text-label-sm hover:underline"
                          >
                            عرض التفاصيل
                          </button>
                        )
                      ) : (
                        <span className="text-on-surface-variant">—</span>
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
