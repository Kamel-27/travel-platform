"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api-client";
import { formatSystemTimestamp } from "@/lib/datetime";
import type { AdminListMeta, AdminUser } from "@/lib/types";
import { EmptyState, ErrorBox, LoadingState, Pager } from "../ui";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<AdminListMeta>({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (email.trim()) params.set("email", email.trim());
      const res = await api.get<{ users: AdminUser[] } & AdminListMeta>(`/admin/users?${params}`);
      setUsers(res.users);
      setMeta({ total: res.total, limit: res.limit, offset: res.offset });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تحميل المستخدمين.");
    } finally {
      setLoading(false);
    }
  }, [email, offset]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const toggleActive = async (u: AdminUser) => {
    const deactivating = u.is_active;
    if (
      deactivating &&
      !window.confirm(`سيتم تعطيل حساب ${u.email} وإنهاء جلساته عند أول تحديث للرمز. متابعة؟`)
    ) {
      return;
    }
    setBusyId(u.id);
    setActionMsg(null);
    try {
      await api.patch(`/admin/users/${u.id}`, { is_active: !u.is_active });
      setActionMsg(deactivating ? `تم تعطيل حساب ${u.email}.` : `تم تفعيل حساب ${u.email}.`);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل تحديث حالة الحساب.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">المستخدمون</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
        تعطيل حساب يُبطل رموز التحديث الخاصة به، فتنتهي جلسته خلال دقائق (مدة صلاحية رمز الوصول).
      </p>

      {actionMsg && (
        <div className="p-md bg-green-100 dark:bg-green-900/30 border border-green-600 rounded-xl text-green-800 dark:text-green-300 mb-md font-body-md text-body-md flex justify-between items-start gap-md">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="material-symbols-outlined text-[20px]">close</button>
        </div>
      )}
      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap gap-base mb-md items-center">
        <input
          value={email}
          onChange={(e) => { setEmail(e.target.value); setOffset(0); }}
          placeholder="البحث بالبريد الإلكتروني (مطابقة تامة)"
          className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-label-md text-label-md text-on-surface w-72"
        />
      </div>

      {loading ? (
        <LoadingState label="جاري تحميل المستخدمين..." />
      ) : users.length === 0 ? (
        <EmptyState icon="group_off" label="لا يوجد مستخدمون مطابقون." />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-md text-label-md">
                  <th className="p-base">البريد الإلكتروني</th>
                  <th className="p-base">الاسم</th>
                  <th className="p-base">الدور</th>
                  <th className="p-base">الحالة</th>
                  <th className="p-base">تاريخ التسجيل</th>
                  <th className="p-base">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-outline-variant/40 font-body-md text-body-md hover:bg-surface-container/40">
                    <td className="p-base font-bold">{u.email}</td>
                    <td className="p-base">{u.full_name || "—"}</td>
                    <td className="p-base">
                      {u.role === "technical_admin" ? (
                        <span className="bg-primary/10 text-primary px-sm py-1 rounded-full text-label-sm font-label-sm">مسؤول نظام</span>
                      ) : (
                        <span className="text-on-surface-variant">مستخدم</span>
                      )}
                    </td>
                    <td className="p-base">
                      {u.is_active ? (
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-sm py-1 rounded-full text-label-sm font-label-sm">نشط</span>
                      ) : (
                        <span className="bg-error-container/20 text-error px-sm py-1 rounded-full text-label-sm font-label-sm">معطّل</span>
                      )}
                    </td>
                    <td className="p-base whitespace-nowrap text-on-surface-variant">{formatSystemTimestamp(u.created_at)}</td>
                    <td className="p-base">
                      {u.id !== currentAdmin?.id && (
                        <button
                          onClick={() => void toggleActive(u)}
                          disabled={busyId === u.id}
                          className={`px-sm py-xs rounded-lg font-label-sm text-label-sm disabled:opacity-60 transition-all ${
                            u.is_active
                              ? "bg-error-container/20 text-error hover:bg-error-container/40"
                              : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 hover:brightness-110"
                          }`}
                        >
                          {busyId === u.id ? "جاري..." : u.is_active ? "تعطيل" : "تفعيل"}
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
