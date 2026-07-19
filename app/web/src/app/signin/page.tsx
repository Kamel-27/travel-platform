"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api, ApiError } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const VALUE_PROPS = [
  { icon: "bolt", text: "تأكيد فوري وتذكرة إلكترونية تصلك مباشرة" },
  { icon: "lock", text: "دفع آمن ومشفر عبر بوابة معتمدة" },
  { icon: "currency_exchange", text: "سياسة إلغاء واسترداد واضحة من صفحة رحلاتي" },
];

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-background" dir="rtl">
      {/* Visual brand panel (desktop only) */}
      <aside className="relative hidden lg:block overflow-hidden">
        <Image
          src="/images/hero/hero-3.jpg"
          alt="السفر مع سفريات"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b2540]/95 via-[#0b2540]/55 to-[#0b2540]/25" />
        <div className="relative z-10 h-full flex flex-col justify-between p-2xl text-white p-12">
          <Link href="/" className="font-headline-lg text-headline-lg font-extrabold drop-shadow-md w-fit hover:opacity-90 transition-opacity">
            سفريات
          </Link>
          <div className="space-y-lg max-w-md">
            <h2 className="font-display-lg text-3xl xl:text-4xl font-extrabold leading-snug drop-shadow-md">
              رحلتك القادمة تبدأ بتسجيل دخول واحد
            </h2>
            <ul className="space-y-md">
              {VALUE_PROPS.map((p) => (
                <li key={p.icon} className="flex items-center gap-sm">
                  <span className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined !text-[20px]">{p.icon}</span>
                  </span>
                  <span className="font-body-lg text-body-lg text-white/90">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="font-label-sm text-label-sm text-white/60">© 2026 سفريات (Safariyat). جميع الحقوق محفوظة.</p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md flex flex-col gap-lg">
          <div className="flex flex-col gap-xs text-center lg:text-right">
            <Link href="/" className="lg:hidden font-headline-lg text-headline-lg font-extrabold text-primary mx-auto mb-sm">
              سفريات
            </Link>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              تسجيل الدخول أو إنشاء حساب
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              لا حاجة لكلمة مرور — نرسل لك رابط دخول آمن على بريدك، أو تابع بحساب جوجل.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-sm h-13 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container-low hover:border-outline transition-all active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path></svg>
            <span className="font-label-lg text-label-lg font-bold text-on-surface">المتابعة عبر جوجل</span>
          </button>

          <div className="flex items-center gap-base">
            <div className="h-px flex-1 bg-outline-variant"></div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">أو عبر البريد الإلكتروني</span>
            <div className="h-px flex-1 bg-outline-variant"></div>
          </div>

          {status === "sent" ? (
            <div className="flex flex-col items-center gap-base py-lg text-center bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg">
              <span className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-4xl">mark_email_read</span>
              </span>
              <p className="font-title-md text-title-md text-on-surface font-bold">تحقق من بريدك الإلكتروني</p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                أرسلنا رابط تسجيل الدخول إلى <span dir="ltr" className="font-bold">{email}</span>. اضغط على الرابط لإكمال تسجيل الدخول.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="font-label-md text-label-md text-primary hover:underline mt-base cursor-pointer"
              >
                استخدام بريد إلكتروني آخر
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-base" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface font-bold" htmlFor="email">
                  البريد الإلكتروني
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute right-3 text-outline">mail</span>
                  <input
                    className="w-full pr-10 pl-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-body-md text-body-md transition-all"
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
                <div className="bg-error-container/20 border border-error text-error p-md rounded-xl font-label-sm text-label-sm">
                  {error}
                </div>
              )}

              <button
                className="w-full bg-primary text-on-primary hover:brightness-110 transition-all duration-200 py-3.5 rounded-xl font-title-md text-title-md font-bold shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-xs"
                type="submit"
                disabled={status === "sending"}
              >
                {status === "sending" ? (
                  <>
                    <span className="animate-spin h-5 w-5 border-2 border-on-primary border-t-transparent rounded-full"></span>
                    <span>جارِ الإرسال...</span>
                  </>
                ) : (
                  <span>إرسال رابط تسجيل الدخول</span>
                )}
              </button>
            </form>
          )}

          <p className="font-label-sm text-label-sm text-on-surface-variant text-center leading-relaxed">
            بمتابعتك فأنت توافق على{" "}
            <Link href="/terms" className="text-primary hover:underline">الشروط والأحكام</Link>
            {" "}و{" "}
            <Link href="/privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>.
          </p>

          <Link href="/" className="flex items-center justify-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined !text-[18px]">arrow_forward</span>
            العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </main>
    </div>
  );
}
