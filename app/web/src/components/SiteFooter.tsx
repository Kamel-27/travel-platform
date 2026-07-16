"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/** Shared site footer + mobile bottom navigation. Real links only — no mock content. */
export default function SiteFooter() {
  const { user } = useAuth();
  const isAdmin = user?.role === "technical_admin";
  const dashboardPath = isAdmin ? "/admin" : "/user-dashboard";

  return (
    <>
      <footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant pb-16 md:pb-0">
        <div className="w-full py-lg px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-xl mb-xl w-full">
            <div className="max-w-md w-full md:w-[420px] shrink-0">
              <span className="font-headline-md text-headline-md font-extrabold text-primary dark:text-primary-fixed-dim">سفريات</span>
              <p className="text-on-surface-variant mt-sm font-body-md text-body-md">
                منصة سفر عربية لحجز تذاكر الطيران أونلاين — أسعار لحظية من شركات الطيران، دفع آمن، وتأكيد فوري للحجز.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-xl">
              <div>
                <h5 className="font-bold mb-md text-on-surface">الحجز</h5>
                <ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
                  <li><Link className="hover:text-primary hover:underline transition-all" href="/">بحث عن رحلات</Link></li>
                  <li><Link className="hover:text-primary hover:underline transition-all" href="/manage-bookings">إدارة حجوزاتي</Link></li>
                </ul>
              </div>
              <div>
                <h5 className="font-bold mb-md text-on-surface">الدعم</h5>
                <ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
                  <li><Link className="hover:text-primary hover:underline transition-all" href="/support">مركز المساعدة</Link></li>
                  <li><Link className="hover:text-primary hover:underline transition-all" href="/support">اتصل بنا</Link></li>
                </ul>
              </div>
              <div>
                <h5 className="font-bold mb-md text-on-surface">قانوني</h5>
                <ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
                  <li><Link className="hover:text-primary hover:underline transition-all" href="/privacy">سياسة الخصوصية</Link></li>
                  <li><Link className="hover:text-primary hover:underline transition-all" href="/terms">الشروط والأحكام</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-outline-variant pt-lg flex flex-col md:flex-row justify-between items-center gap-base">
            <p className="text-on-surface-variant font-label-sm text-label-sm">© 2026 سفريات (Safariyat). جميع الحقوق محفوظة.</p>
            <p className="text-on-surface-variant font-label-sm text-label-sm flex items-center gap-xs">
              <span className="material-symbols-outlined !text-[18px]">lock</span>
              دفع آمن ومشفر بالكامل
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-around items-center h-16">
          <Link className="flex flex-col items-center gap-xs text-primary" href="/">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            <span className="font-label-sm text-label-sm">الرئيسية</span>
          </Link>
          <Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/support">
            <span className="material-symbols-outlined">support_agent</span>
            <span className="font-label-sm text-label-sm">الدعم</span>
          </Link>
          <Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/manage-bookings">
            <span className="material-symbols-outlined">airplane_ticket</span>
            <span className="font-label-sm text-label-sm">حجوزاتي</span>
          </Link>
          <Link className="flex flex-col items-center gap-xs text-on-surface-variant" href={dashboardPath}>
            <span className="material-symbols-outlined">person</span>
            <span className="font-label-sm text-label-sm">حسابي</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
