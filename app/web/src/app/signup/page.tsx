"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("تم إنشاء الحساب بنجاح بنسخة العرض!");
    window.location.href = "/signin";
  };

  return (
    <div className="safariyat bg-background min-h-screen text-on-surface">
      {/* Top Header */}
      <header className="bg-surface-container-lowest shadow-sm h-16 flex justify-between items-center px-4 md:px-margin-desktop max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Link className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary hover:opacity-80 transition-opacity" href="/">
            سفريات
          </Link>
        </div>
        <div className="flex items-center gap-base">
          <Link className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/signin">
            هل لديك حساب؟
          </Link>
          <Link href="/signin" className="bg-secondary-container text-on-secondary-container px-md py-xs rounded-lg font-label-md text-label-md transition-all hover:bg-secondary-container/80 active:scale-95 cursor-pointer">
            تسجيل الدخول
          </Link>
        </div>
      </header>
      
      {/* Split Main Layout */}
      <main className="min-h-[calc(100vh-64px)] flex flex-col md:flex-row">
        {/* Left Side: Vibrant High-Contrast Brand Promo Panel */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-primary to-primary-container relative overflow-hidden items-center justify-center p-xl">
          <div className="relative z-10 text-white space-y-md">
            <h1 className="font-display-lg text-display-lg leading-tight">ابدأ رحلتك<br/>معنا اليوم</h1>
            <p className="font-body-lg text-body-lg opacity-90">انضم إلى أكثر من مليون مسافر يثقون بسفريات لحجز مغامراتهم القادمة حول العالم.</p>
            
            <div className="pt-lg flex flex-col gap-md">
              <div className="flex items-center gap-base">
                <span className="material-symbols-outlined text-primary-fixed-dim">verified_user</span>
                <span className="font-label-md text-label-md">دفع آمن وشفافية كاملة في الأسعار</span>
              </div>
              <div className="flex items-center gap-base">
                <span className="material-symbols-outlined text-primary-fixed-dim">support_agent</span>
                <span className="font-label-md text-label-md">دعم فني متاح على مدار الساعة بـ 12 لغة</span>
              </div>
              <div className="flex items-center gap-base">
                <span className="material-symbols-outlined text-primary-fixed-dim">redeem</span>
                <span className="font-label-md text-label-md">نقاط ومكافآت حصرية عند كل حجز</span>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 opacity-20">
            <img className="w-full h-full object-cover animate-fade-in" data-alt="A sweeping aerial view of a majestic mountain range at sunrise, with golden light hitting the snow-capped peaks and a soft blue mist in the valleys. The overall aesthetic is clean, premium, and inspiring, mirroring a corporate high-end travel brand identity. The lighting is dramatic yet professional, emphasizing exploration and the vastness of the world." src="https://lh3.googleusercontent.com/aida-public/AB6AXuADaccoi-qx6iiPhNtexPCWx3ghavdvtzahS3ZdhRrFjts4rHBGI2d_tZ8T27hpGKaaDbJNBSosvqzFr-SvCnGRK0oOBEnFO_GgvUTNUaYwc76ON_50Ytqq21pzJWQF4lnxy1gJY2SSESvO_d4Y8dQ6DDWBZ9P4rQFqwkjJ9bjtmkRuhVSBIZ6x9iB4UEIVuP-8k4-cQqg9M7YXO9jR1sXnTi4IPFioQUAdst0qtIyxrNZ3ZmBunYTdVuyLsxveggFUEQZvnZ1R3ERy"/>
          </div>
        </div>

        {/* Right Side: Centered Premium Light Sign Up Form */}
        <div className="flex-1 flex items-center justify-center p-margin-mobile md:p-xl bg-surface">
          <div className="w-full max-w-lg glass-panel p-md md:p-lg rounded-xl shadow-lg border border-outline-variant/30">
            <div className="mb-lg">
              <div className="flex items-center justify-between mb-xs">
                <span className="text-primary font-label-md text-label-md">إنشاء الحساب</span>
                <span className="text-on-surface-variant font-label-sm text-label-sm">الخطوة 1 من 2</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary w-1/2 transition-all duration-700 ease-in-out"></div>
              </div>
            </div>

            <div className="mb-lg">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">أنشئ حسابك الشخصي</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">أدخل تفاصيلك للتمتع بتجربة حجز أسرع وعروض مخصصة.</p>
            </div>

            <form className="space-y-md" onSubmit={handleSubmit}>
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="full_name">الاسم الكامل</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">person</span>
                  <input className="w-full pr-11 pl-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md" id="full_name" placeholder="محمد أحمد" required type="text"/>
                </div>
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="email">البريد الإلكتروني</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">mail</span>
                  <input className="w-full pr-11 pl-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md text-right font-sans" dir="ltr" id="email" placeholder="example@domain.com" required type="email"/>
                </div>
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="phone">رقم الهاتف</label>
                <div className="flex gap-2" dir="ltr">
                  <select className="w-32 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md text-center">
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+965">🇰🇼 +965</option>
                    <option value="+20">🇪🇬 +20</option>
                    <option value="+962">🇯🇴 +962</option>
                  </select>
                  <input className="flex-1 px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md" id="phone" placeholder="50 000 0000" required type="tel"/>
                </div>
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="password">كلمة المرور</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">lock</span>
                  <input className="w-full pr-11 pl-12 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md" id="password" placeholder="••••••••" required type={showPassword ? "text" : "password"}/>
                  <button className="absolute left-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors cursor-pointer animate-fade-in" onClick={() => setShowPassword(!showPassword)} type="button">
                    <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">يجب أن تحتوي على 8 أحرف على الأقل، تتضمن أرقام ورموز.</p>
              </div>

              <div className="flex items-start gap-base pt-2">
                <div className="flex items-center h-5">
                  <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer transition-all" id="terms" required type="checkbox"/>
                </div>
                <label className="font-body-md text-body-md text-on-surface-variant" htmlFor="terms">
                  أوافق على <Link className="text-primary hover:underline" href="/">الشروط والأحكام</Link> و <Link className="text-primary hover:underline" href="/">سياسة الخصوصية</Link> الخاصة بسفريات.
                </label>
              </div>

              <button className="w-full bg-tertiary-container text-on-tertiary-container py-md rounded-lg font-title-lg text-title-lg shadow-md hover:brightness-110 transition-all active:scale-98 mt-lg flex items-center justify-center gap-base cursor-pointer" type="submit">
                <span>إنشاء الحساب</span>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
            </form>

            <div className="relative my-lg">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant"></div></div>
              <div className="relative flex justify-center text-label-sm text-label-sm">
                <span className="bg-surface-container-lowest px-md text-on-surface-variant">أو التسجيل عبر</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <button className="flex items-center justify-center gap-base py-3 px-4 rounded-lg border border-outline-variant bg-white hover:bg-surface transition-all cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path></svg>
                <span className="font-label-md text-label-md">جوجل</span>
              </button>
              <button className="flex items-center justify-center gap-base py-3 px-4 rounded-lg border border-outline-variant bg-white hover:bg-surface transition-all cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"></path></svg>
                <span className="font-label-md text-label-md">فيسبوك</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container border-t border-outline-variant py-md px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-base text-on-surface-variant font-label-sm text-label-sm">
          <p>© 2026 سفريات. جميع الحقوق محفوظة.</p>
          <div className="flex gap-md">
            <Link className="hover:text-primary transition-colors" href="/">عن سفريات</Link>
            <Link className="hover:text-primary transition-colors" href="/">سياسة الخصوصية</Link>
            <Link className="hover:text-primary transition-colors" href="/support">اتصل بنا</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
