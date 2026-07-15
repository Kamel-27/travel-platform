"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { consumeReturnPath } from "@/lib/return-path";

const ERROR_MESSAGES: Record<string, string> = {
  account_disabled: "هذا الحساب معطل. يرجى التواصل مع الدعم.",
  auth_failed: "تعذر تسجيل الدخول عبر جوجل. يرجى المحاولة مرة أخرى.",
};

function CallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const error = searchParams.get("error");

  useEffect(() => {
    if (!error && !isLoading && isAuthenticated) {
      const fallback = user?.role === "technical_admin" ? "/admin" : "/user-dashboard";
      router.replace(consumeReturnPath() || fallback);
    }
  }, [error, isLoading, isAuthenticated, router, user]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-base text-center">
        <span className="material-symbols-outlined text-error text-5xl">error</span>
        <p className="font-title-md text-title-md text-on-surface">
          {ERROR_MESSAGES[error] ?? "حدث خطأ أثناء تسجيل الدخول"}
        </p>
        <Link href="/signin" className="bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md mt-base">
          العودة لتسجيل الدخول
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-base">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-body-md text-body-md text-on-surface-variant">جارِ إكمال تسجيل الدخول...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-base text-center">
        <span className="material-symbols-outlined text-error text-5xl">error</span>
        <p className="font-title-md text-title-md text-on-surface">تعذر إكمال تسجيل الدخول</p>
        <Link href="/signin" className="bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md mt-base">
          العودة لتسجيل الدخول
        </Link>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={null}>
        <CallbackInner />
      </Suspense>
    </div>
  );
}
