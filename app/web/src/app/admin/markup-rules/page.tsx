"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatSystemTimestamp } from "@/lib/datetime";
import type { MarkupRule } from "@/lib/types";
import { EmptyState, ErrorBox, LoadingState } from "../ui";

export default function AdminMarkupRulesPage() {
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create form
  const [newType, setNewType] = useState<"percentage" | "fixed">("percentage");
  const [newValue, setNewValue] = useState("");
  const [newActive, setNewActive] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<MarkupRule[]>("/admin/markup-rules");
      setRules(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل قواعد هامش الربح.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(newValue);
    if (!Number.isFinite(value) || value < 0) {
      setError("أدخل قيمة صحيحة.");
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      // Fixed markups are entered in minor units to match the API contract
      // (integer minor units everywhere) — the label says so explicitly.
      await api.post("/admin/markup-rules", {
        type: newType,
        value,
        is_active: newActive,
      });
      setActionMsg(newActive ? "تم إنشاء القاعدة وتفعيلها (أُلغي تفعيل القاعدة السابقة)." : "تم إنشاء القاعدة (غير مفعّلة).");
      setNewValue("");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل إنشاء القاعدة.");
    } finally {
      setBusy(false);
    }
  };

  const activate = async (rule: MarkupRule) => {
    setBusy(true);
    setActionMsg(null);
    try {
      await api.patch(`/admin/markup-rules/${rule.id}`, { is_active: true });
      setActionMsg("تم تفعيل القاعدة — القاعدة النشطة السابقة أُلغي تفعيلها تلقائياً.");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل تفعيل القاعدة.");
    } finally {
      setBusy(false);
    }
  };

  const describeValue = (rule: MarkupRule) =>
    rule.type === "percentage" ? `${rule.value}%` : `${rule.value} (وحدات صغرى)`;

  return (
    <>
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">قواعد هامش الربح</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        قاعدة واحدة نشطة في أي وقت — تفعيل قاعدة يلغي تفعيل السابقة تلقائياً. القيم الثابتة تُدخل بالوحدات الصغرى للعملة (مثلاً 500 = 5.00 دولار).
      </p>

      {actionMsg && (
        <div className="p-md bg-green-100 dark:bg-green-900/30 border border-green-600 rounded-xl text-green-800 dark:text-green-300 mb-md font-body-md text-body-md flex justify-between items-start gap-md">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="material-symbols-outlined text-[20px]">close</button>
        </div>
      )}
      {error && <ErrorBox message={error} />}

      <form onSubmit={createRule} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm mb-lg flex flex-wrap items-end gap-md">
        <label className="font-label-md text-label-md text-on-surface-variant">
          النوع
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as "percentage" | "fixed")}
            className="block mt-xs bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface"
          >
            <option value="percentage">نسبة مئوية %</option>
            <option value="fixed">مبلغ ثابت (وحدات صغرى)</option>
          </select>
        </label>
        <label className="font-label-md text-label-md text-on-surface-variant">
          القيمة
          <input
            type="number"
            step="any"
            min="0"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            required
            className="block mt-xs bg-surface-container border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface w-36"
          />
        </label>
        <label className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant cursor-pointer pb-sm">
          <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} className="rounded" />
          تفعيل فوراً
        </label>
        <button
          type="submit"
          disabled={busy}
          className="bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md hover:brightness-110 disabled:opacity-60 transition-all"
        >
          {busy ? "جاري..." : "إنشاء قاعدة"}
        </button>
      </form>

      {loading ? (
        <LoadingState label="جاري تحميل القواعد..." />
      ) : rules.length === 0 ? (
        <EmptyState icon="percent" label="لا توجد قواعد بعد — بدون قاعدة نشطة لا يُضاف أي هامش على الأسعار." />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                  <th className="p-base">النوع</th>
                  <th className="p-base">القيمة</th>
                  <th className="p-base">الحالة</th>
                  <th className="p-base">آخر تحديث</th>
                  <th className="p-base">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-t border-outline-variant/40 font-body-md text-body-md hover:bg-surface-container/40">
                    <td className="p-base">{rule.type === "percentage" ? "نسبة مئوية" : "مبلغ ثابت"}</td>
                    <td className="p-base font-bold">{describeValue(rule)}</td>
                    <td className="p-base">
                      {rule.is_active ? (
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-sm py-1 rounded-full text-label-sm font-label-sm">نشطة</span>
                      ) : (
                        <span className="text-on-surface-variant font-label-sm">غير مفعّلة</span>
                      )}
                    </td>
                    <td className="p-base whitespace-nowrap text-on-surface-variant">{formatSystemTimestamp(rule.updated_at)}</td>
                    <td className="p-base">
                      {!rule.is_active && (
                        <button
                          onClick={() => void activate(rule)}
                          disabled={busy}
                          className="bg-primary/10 text-primary px-sm py-xs rounded-lg font-label-sm text-label-sm hover:bg-primary/20 disabled:opacity-60 transition-all"
                        >
                          تفعيل
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
