"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  size: number;
  color: string;
  duration: number;
}

export default function BookingConfirmationPage() {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    // Generate particles
    const colors = ["#22c55e", "#4ade80", "#16a34a", "#86efac", "#3b82f6", "#2dd4bf"];
    const pieces: ConfettiPiece[] = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // percentage
      delay: Math.random() * 4, // seconds
      size: Math.random() * 8 + 6, // pixels
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: Math.random() * 3 + 2, // seconds
    }));
    setConfetti(pieces);
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans relative overflow-x-hidden" dir="rtl">
      {/* Confetti Falling Effect */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute top-0 rounded-sm opacity-80 animate-[fall_linear_infinite]"
            style={{
              left: `${c.left}%`,
              width: `${c.size}px`,
              height: `${c.size}px`,
              backgroundColor: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes fall {
          0% {
            transform: translateY(-50px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>

      {/* TopNavBar */}
      <header className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm sticky top-0 z-50 border-b border-outline-variant">
        <nav className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto h-16">
          <div className="flex items-center gap-md">
            <Link href="/" className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary">
              سفريات
            </Link>
            <div className="hidden md:flex gap-base">
              <Link className="font-label-md text-label-md text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors px-xs" href="/">
                رحلات طيران
              </Link>
              <Link className="font-label-md text-label-md text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors px-xs" href="/hotels">
                فنادق
              </Link>
              <Link className="font-label-md text-label-md text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors px-xs" href="/support">
                الدعم والمساعدة
              </Link>
              <Link className="font-label-md text-label-md text-primary dark:text-inverse-primary font-bold border-b-2 border-primary pb-1 px-xs" href="/manage-bookings">
                رحلاتي
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-base">
            <div className="hidden md:flex items-center gap-xs ml-4">
              <span className="material-symbols-outlined text-primary">language</span>
              <span className="font-label-md text-label-md">USD / AR</span>
            </div>
            <Link href="/signin" className="bg-primary text-on-primary px-md py-xs rounded-lg font-label-md text-label-md scale-98 active:scale-95 transition-transform">
              تسجيل الدخول
            </Link>
          </div>
        </nav>
      </header>

      {/* Celebration Hero Section */}
      <section className="relative overflow-hidden bg-surface-container-low py-xl px-margin-mobile border-b border-outline-variant/30">
        <div className="max-w-max-width mx-auto flex flex-col items-center text-center relative z-10">
          {/* Success Badge */}
          <div className="mb-md animate-[bounce_2s_infinite]">
            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <span className="material-symbols-outlined text-[48px] text-green-500 font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold mb-xs">تم تأكيد حجزك بنجاح! 🎉</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            رقم مرجع الحجز الإلكتروني (PNR):{" "}
            <span className="font-bold text-primary select-all text-lg font-mono">#SAF-98249-RUH</span>
          </p>
        </div>
      </section>

      {/* Main Content Grid */}
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-lg pb-xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
          {/* Left Column: Trip Overview Card */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-md border-b border-outline-variant bg-surface-container-low">
                <h2 className="font-title-lg text-title-lg font-bold flex items-center gap-base">
                  <span className="material-symbols-outlined text-primary">flight_takeoff</span>
                  تفاصيل الرحلة والمسافرين
                </h2>
              </div>
              <div className="p-md">
                {/* Flight Info Segment */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-md mb-lg p-md bg-surface-bright rounded-xl border border-outline-variant">
                  <div className="flex items-center gap-md w-full md:w-auto">
                    <img 
                      alt="Riyadh Air Logo" 
                      className="w-12 h-12 object-contain bg-surface-container p-2 rounded-lg" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAek2TiG_GKZQFouM2HG9Ccxff3euzlv1GSplNWXvnM6vg46F-PBxju2G9A77X661vrW7vG-va-dpvvbdDgUInZ21GTMEBd3sEtB0sAKSyRrnb9sxnvkMaUY29GJcW0qVb58goDcHlchELOySSBwCNXUmpVsHRHH68a9La1fW--nk2p7kvW15aj5LN8hE4BZ2f2uKs8pSdwD1HBd-rn54XSCOplPueZGr29dg2mY-iU2s1WymJdwx5PBI5CwVPTG6Mz6PXoSfpSOfJH" 
                    />
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant font-bold">طيران الرياض</p>
                      <p className="font-title-lg text-title-lg font-bold text-on-surface">SV 124</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-lg flex-1 justify-center w-full mt-sm md:mt-0">
                    <div className="text-right">
                      <p className="font-headline-md text-headline-md font-bold text-on-surface">08:00 ص</p>
                      <p className="font-label-md text-label-md text-primary font-bold">RUH</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">الرياض</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center relative px-md">
                      <span className="font-label-sm text-label-sm text-on-surface-variant mb-xs">2س 15د</span>
                      <div className="w-full h-[2px] bg-outline-variant relative">
                        <div className="absolute -top-1 right-0 w-2 h-2 rounded-full bg-primary"></div>
                        <div className="absolute -top-1 left-0 w-2 h-2 rounded-full bg-outline"></div>
                        <span className="material-symbols-outlined absolute left-1/2 -translate-x-1/2 -top-3 bg-surface-bright px-xs text-primary text-sm">flight</span>
                      </div>
                      <span className="font-label-sm text-label-sm text-green-500 font-bold mt-xs">مباشر</span>
                    </div>
                    <div className="text-left">
                      <p className="font-headline-md text-headline-md font-bold text-on-surface">11:15 ص</p>
                      <p className="font-label-md text-label-md text-primary font-bold">DXB</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">دبي</p>
                    </div>
                  </div>
                </div>

                {/* Passenger & Seat Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div className="flex items-start gap-md p-md rounded-xl border border-outline-variant bg-surface-container-low">
                    <span className="material-symbols-outlined text-primary text-2xl">person</span>
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">المسافر الأول الرئيسي</p>
                      <p className="font-body-lg text-body-lg font-bold text-on-surface">محمد العتيبي</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-md p-md rounded-xl border border-outline-variant bg-surface-container-low">
                    <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>event_seat</span>
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">المقعد المختار</p>
                      <p className="font-body-lg text-body-lg font-bold text-on-surface">12A (مجاورة للنافذة)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Maps Preview Section */}
            <div className="h-48 w-full bg-surface-dim relative overflow-hidden mt-md">
              <img 
                alt="Location Map" 
                className="w-full h-full object-cover opacity-60" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDt_naIMsy_t3isLhagkZRAijm_oV4drZq9VSWnWoaNNx9TgQAcI1GWFFH2VbuQllFm0hhGLLej1I8fzG_KLbm8nyUV0XE7RO-8_irfK-stucbrVlBRUJGbndar_nNDbEoQ6a1a0nxZArTJT6oEIxEkYlEi4kfcO5-GBpPAPjARUqNrlxetjdA8ErJ2SxAx9t9TLLnHDT6yvQispZyp8ooUh0NRdHUZWyeKTiO-F3E814wDwBXubJqDRjiDQO_-vZv1qqimhpFtx01H" 
              />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                <div className="bg-surface-container-lowest/90 backdrop-blur-md px-md py-sm rounded-full shadow-lg flex items-center gap-xs border border-outline-variant/50">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  <span className="font-label-md text-label-md font-bold text-on-surface">دبي، الإمارات العربية المتحدة</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Actions Panel */}
          <aside className="flex flex-col gap-md">
            <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
              <h3 className="font-title-lg text-title-lg mb-md font-bold border-b border-outline-variant/30 pb-sm">إجراءات الحجز</h3>
              <div className="flex flex-col gap-sm">
                
                {/* Primary PDF Download */}
                <button className="w-full bg-primary hover:bg-primary-container text-white py-md px-md rounded-xl flex items-center justify-center gap-base font-label-md text-label-md shadow-md active:scale-95 transition-transform cursor-pointer font-bold">
                  <span className="material-symbols-outlined">download</span>
                  تحميل تذكرة الطيران (PDF)
                </button>
                
                {/* Secondary Email */}
                <button className="w-full bg-white hover:bg-surface-container text-primary border border-primary py-md px-md rounded-xl flex items-center justify-center gap-base font-label-md text-label-md active:scale-95 transition-transform cursor-pointer font-bold">
                  <span className="material-symbols-outlined">mail</span>
                  إرسال الحجز للبريد الإلكتروني
                </button>
                
                {/* Apple Wallet Shortcut */}
                <button className="w-full bg-black hover:bg-zinc-900 text-white py-md px-md rounded-xl flex items-center justify-center gap-base font-label-md text-label-md active:scale-95 transition-transform cursor-pointer font-bold border border-zinc-800">
                  <span className="material-symbols-outlined">wallet</span>
                  إضافة إلى محفظة Apple Wallet
                </button>

                <div className="h-px bg-outline-variant/30 my-sm"></div>
                
                {/* Secondary Links */}
                <Link 
                  href="/manage-bookings" 
                  className="flex items-center justify-center gap-xs font-label-md text-label-md text-primary font-bold hover:underline cursor-pointer py-xs"
                >
                  <span className="material-symbols-outlined text-lg">dashboard</span>
                  الذهاب إلى لوحة تحكم رحلاتي
                </Link>
              </div>
            </div>

            {/* Support Card */}
            <div className="bg-secondary-container p-md rounded-xl border border-outline-variant/50 text-on-secondary-container flex items-center gap-md">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                <span className="material-symbols-outlined text-primary">support_agent</span>
              </div>
              <div>
                <p className="font-label-md text-label-md font-bold">هل تحتاج لأي مساعدة إضافية؟</p>
                <p className="font-label-sm text-label-sm opacity-80 mt-0.5">فريق دعم سفريات متواجد 24/7 لمساعدتكم.</p>
                <Link href="/support" className="text-primary font-bold text-label-sm hover:underline mt-1 block">افتح تذكرة دعم الآن</Link>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant mt-xl">
        <div className="w-full py-lg px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <div className="flex flex-col gap-xs items-center md:items-start">
            <span className="font-headline-md text-headline-md font-extrabold text-primary">سفريات</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">© 2026 سفريات. جميع الحقوق محفوظة.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-md">
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline opacity-80 hover:opacity-100 transition-opacity" href="/">عن سفريات</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline opacity-80 hover:opacity-100 transition-opacity" href="/">سياسة الخصوصية</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline opacity-80 hover:opacity-100 transition-opacity" href="/">الشروط والأحكام</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline opacity-80 hover:opacity-100 transition-opacity" href="/support">اتصل بنا</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline opacity-80 hover:opacity-100 transition-opacity" href="/support">الأسئلة الشائعة</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
