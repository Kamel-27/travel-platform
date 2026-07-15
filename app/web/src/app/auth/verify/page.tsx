"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { consumeReturnPath } from "@/lib/return-path";
import type { SessionResponse } from "@/lib/types";

function VerifyInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"verifying" | "error">(token ? "verifying" : "error");

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const session = await api.post<SessionResponse>(
          "/auth/magic-link/verify",
          { token },
          { skipAuth: true, skipAuthRetry: true },
        );
        if (cancelled) return;
        login(session);
        const fallback = session.user?.role === "technical_admin" ? "/admin" : "/user-dashboard";
        router.replace(consumeReturnPath() || fallback);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        void err; // TOKEN_INVALID / expired / used — same message regardless (no oracle on the reason)
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center gap-base">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-body-md text-body-md text-on-surface-variant">جارِ التحقق من الرابط...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-base text-center">
      <span className="material-symbols-outlined text-error text-5xl">error</span>
      <p className="font-title-md text-title-md text-on-surface">الرابط غير صالح أو منتهي الصلاحية</p>
      <p className="font-body-md text-body-md text-on-surface-variant">يرجى طلب رابط جديد لتسجيل الدخول.</p>
      <Link href="/signin" className="bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md mt-base">
        العودة لتسجيل الدخول
      </Link>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={null}>
        <VerifyInner />
      </Suspense>
    </div>
  );
}
