"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Legacy route. The customer booking list now lives in /user-dashboard and
 * the admin one in /admin/bookings; this stays as a redirect so old links
 * and bookmarks keep working.
 */
export default function ManageBookingsRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const target = user?.role === "technical_admin" ? "/admin/bookings" : "/user-dashboard";
    router.replace(target);
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-md" dir="rtl">
      <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
      <p className="font-title-md">جاري تحويلك إلى صفحة حجوزاتك...</p>
    </div>
  );
}
