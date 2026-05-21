"use client";

import { useState } from "react";
import Link from "next/link";

export default function DesignSwitcher() {
  const [isOpen, setIsOpen] = useState(false);

  const pages = [
    { name: "الرئيسية (Homepage)", path: "/", icon: "home" },
    { name: "نتائج طيران (Flight Search)", path: "/flights", icon: "flight" },
    { name: "تفاصيل الرحلة (Flight Details)", path: "/flights/details", icon: "flight_takeoff" },
    { name: "نتائج فنادق (Hotel Search)", path: "/hotels", icon: "hotel" },
    { name: "تفاصيل الفندق (Hotel Details)", path: "/hotels/details", icon: "hotel_class" },
    { name: "إتمام بيانات الحجز (Checkout)", path: "/checkout", icon: "shopping_cart_checkout" },
    { name: "بوابة الدفع الآمنة (Secure Payment)", path: "/checkout/payment", icon: "credit_card" },
    { name: "تأكيد الحجز (Confirmation)", path: "/checkout/confirmation", icon: "check_circle" },
    { name: "مركز الدعم والمساعدة (Support)", path: "/support", icon: "support_agent" },
    { name: "لوحة التحكم المشرف (Admin Dashboard)", path: "/dashboard-overview", icon: "dashboard" },
    { name: "لوحة تحكم المستخدم (User Dashboard)", path: "/user-dashboard", icon: "account_circle" },
    { name: "إدارة الحجوزات (Manage Bookings)", path: "/manage-bookings", icon: "book_online" },
    { name: "تسجيل الدخول (Sign In)", path: "/signin", icon: "login" },
    { name: "إنشاء حساب (Sign Up)", path: "/signup", icon: "person_add" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans" dir="rtl">
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
      >
        <span className="material-symbols-outlined text-2xl">
          {isOpen ? "close" : "navigation"}
        </span>
      </button>

      {/* Switcher Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-outline-variant/30 animate-fade-in text-on-surface">
          <div className="flex justify-between items-center mb-3 border-b border-outline-variant pb-2">
            <span className="font-bold text-primary font-headline-md text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">palette</span>
              مستعرض التصاميم | Safariyat
            </span>
          </div>

          <div className="flex flex-col gap-1 max-h-[350px] overflow-y-auto pr-1">
            {pages.map((p, idx) => (
              <Link
                key={idx}
                href={p.path}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors text-right text-[14px] font-medium"
              >
                <span className="material-symbols-outlined text-xl">{p.icon}</span>
                <span>{p.name}</span>
              </Link>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-outline-variant/30 text-center">
            <span className="text-[11px] text-outline font-label-sm">
              تم الاستيراد من Google Stitch بنجاح ✨
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
