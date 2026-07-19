"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/admin", icon: "dashboard", label: "نظرة عامة" },
  { href: "/admin/bookings", icon: "airplane_ticket", label: "الحجوزات" },
  { href: "/admin/ledger", icon: "account_balance_wallet", label: "دفتر الأستاذ" },
  { href: "/admin/refunds", icon: "currency_exchange", label: "الاستردادات" },
  { href: "/admin/support", icon: "support_agent", label: "تذاكر الدعم" },
  { href: "/admin/users", icon: "group", label: "المستخدمون" },
  { href: "/admin/markup-rules", icon: "percent", label: "هامش الربح" },
  { href: "/admin/audit-logs", icon: "history", label: "سجل التدقيق" },
];

/**
 * Client-side gate for the admin area. This is UX only — every /admin/*
 * API call is enforced server-side by JwtAuthGuard + RolesGuard
 * (technical_admin), so a non-admin reaching this tree sees nothing and
 * can do nothing.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-md" dir="rtl">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-title-md text-title-md">جاري التحقق من الصلاحيات...</p>
      </div>
    );
  }

  if (!user || user.role !== "technical_admin") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-outline text-5xl">shield_lock</span>
        <p className="font-title-md text-title-md">هذه الصفحة متاحة لمسؤولي النظام فقط.</p>
        <div className="flex gap-base mt-md">
          {!user && (
            <Link
              href="/signin?next=/admin"
              className="bg-primary text-on-primary px-lg py-md rounded-xl font-bold font-title-lg shadow-md hover:opacity-90 active:scale-95 transition-all"
            >
              تسجيل الدخول
            </Link>
          )}
          <Link
            href="/"
            className="bg-surface-container-high text-on-surface px-lg py-md rounded-xl font-title-lg hover:bg-surface-container-highest transition-all"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      <aside className="w-64 flex-shrink-0 bg-surface-container-lowest border-l border-outline-variant hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-md h-16 flex items-center justify-center border-b border-outline-variant/50">
          <Link href="/" className="font-headline-md text-headline-md font-extrabold text-primary hover:opacity-90 transition-opacity">
            سفريات
          </Link>
        </div>
        <nav className="flex-1 px-base mt-md space-y-xs overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-base px-md py-sm rounded-lg transition-all ${
                  active
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="font-label-md text-label-md">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-md border-t border-outline-variant space-y-xs">
          <p className="font-label-md text-label-md text-on-surface truncate">{user.full_name || user.email}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">مسؤول النظام</p>
          <button
            onClick={() => logout()}
            className="w-full mt-xs bg-surface-container-high text-on-surface px-md py-xs rounded-lg font-label-md text-label-md hover:bg-surface-container-highest transition-all"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar (sidebar is hidden below md) */}
        <header className="md:hidden h-14 bg-surface-container-lowest border-b border-outline-variant flex items-center gap-sm px-base overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-sm py-xs rounded-lg font-label-sm text-label-sm whitespace-nowrap ${
                pathname === item.href ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </header>
        <main className="flex-1 p-md md:p-lg max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
