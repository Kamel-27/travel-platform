"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function SigninPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      await api.post("/auth/magic-link/request", { email }, { skipAuth: true, skipAuthRetry: true });
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "حدث خطأ أثناء إرسال الرابط");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 bg-login-hero" />

      <main className="z-10 w-full max-w-md px-4 md:px-0 relative flex flex-col items-center justify-center">
        <div className="w-full glass-panel rounded-xl shadow-lg p-md md:p-xl flex flex-col gap-md border border-outline-variant/30">
          <div className="flex flex-col items-center gap-xs">
            <Link href="/" className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-primary hover:opacity-80 transition-opacity">
              سفريات
            </Link>
            <p className="font-body-md text-body-md text-on-surface-variant text-center">أهلاً بك مجدداً! رحلتك القادمة تبدأ من هنا.</p>
          </div>

          {status === "sent" ? (
            <div className="flex flex-col items-center gap-base py-lg text-center">
              <span className="material-symbols-outlined text-primary text-5xl">mark_email_read</span>
              <p className="font-title-md text-title-md text-on-surface">تحقق من بريدك الإلكتروني</p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                أرسلنا رابط تسجيل الدخول إلى <span dir="ltr">{email}</span>. اضغط على الرابط لإكمال تسجيل الدخول.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="font-label-md text-label-md text-primary hover:underline mt-base"
              >
                استخدام بريد إلكتروني آخر
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-base" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface" htmlFor="email">البريد الإلكتروني</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute right-3 text-outline">mail</span>
                  <input
                    className="w-full pr-10 pl-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md"
                    id="email"
                    placeholder="example@domain.com"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              {error && (
                <p className="font-label-sm text-label-sm text-error text-center">{error}</p>
              )}

              <button
                className="w-full mt-base bg-tertiary-container hover:bg-tertiary transition-all duration-300 py-4 rounded-lg font-headline-md text-on-tertiary-container shadow-md active:scale-98 cursor-pointer disabled:opacity-60"
                type="submit"
                disabled={status === "sending"}
              >
                {status === "sending" ? "جارِ الإرسال..." : "إرسال رابط تسجيل الدخول"}
              </button>
            </form>
          )}

          <div className="flex items-center gap-base">
            <div className="h-px flex-1 bg-outline-variant"></div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">أو</span>
            <div className="h-px flex-1 bg-outline-variant"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-xs py-3 bg-white border border-outline-variant rounded-lg hover:bg-surface-container-low transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path></svg>
            <span className="font-label-md text-label-md text-secondary">المتابعة عبر جوجل</span>
          </button>
        </div>

        <footer className="mt-xl text-center">
          <div className="flex justify-center gap-md mb-base">
            <Link className="font-label-sm text-label-sm text-white/80 hover:text-white transition-colors" href="/">عن سفريات</Link>
            <Link className="font-label-sm text-label-sm text-white/80 hover:text-white transition-colors" href="/support">اتصل بنا</Link>
          </div>
          <p className="font-label-sm text-label-sm text-white/60">© 2026 سفريات. جميع الحقوق محفوظة.</p>
        </footer>
      </main>
    </div>
  );
}
