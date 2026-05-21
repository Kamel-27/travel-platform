"use client";

import { useState } from "react";
import Link from "next/link";

export default function FlightDetailsPage() {
  const [travelClass, setTravelClass] = useState("سياحية");

  const basePrice = travelClass === "سياحية" ? 1450 : travelClass === "رجال الأعمال" ? 3200 : 5400;
  const taxes = travelClass === "سياحية" ? 240 : travelClass === "رجال الأعمال" ? 450 : 800;
  const totalPrice = basePrice + taxes;

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto h-16">
          <div className="flex items-center gap-lg">
            <Link href="/" className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary">
              سفريات
            </Link>
            <nav className="hidden md:flex items-center gap-md">
              <Link className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors" href="/flights">
                رحلات طيران
              </Link>
              <Link className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors" href="/hotels">
                فنادق
              </Link>
              <Link className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors" href="/support">
                الدعم والمساعدة
              </Link>
              <Link className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors" href="/manage-bookings">
                رحلاتي
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-md">
            <div className="hidden md:flex items-center gap-sm">
              <span className="material-symbols-outlined text-outline">language</span>
              <span className="font-label-md text-label-md">USD / AR</span>
            </div>
            <Link href="/signin" className="bg-primary-container text-white px-md py-xs rounded-lg font-label-md text-label-md transition-transform active:scale-95 text-center flex items-center justify-center">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-lg grid grid-cols-1 lg:grid-cols-10 gap-lg">
        {/* Right Panel (70%) */}
        <section className="lg:col-span-7 flex flex-col gap-md">
          <div className="flex items-center justify-between mb-xs">
            <h1 className="font-headline-md text-headline-md text-primary font-bold">تفاصيل الرحلة من الرياض إلى دبي</h1>
            <span className="bg-primary-fixed text-on-primary-fixed px-sm py-xs rounded-full font-label-sm text-label-sm">الذهاب فقط</span>
          </div>

          {/* Detailed Flight Timeline */}
          <div className="bg-white rounded-xl border border-outline-variant p-md relative overflow-hidden shadow-sm">
            {/* Segment 1 */}
            <div className="relative z-10 grid grid-cols-12 gap-base mb-lg">
              <div className="col-span-1 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined">flight_takeoff</span>
                </div>
                <div className="h-full w-px bg-outline-variant mt-2 min-h-[140px]"></div>
              </div>
              <div className="col-span-11 pr-sm">
                <div className="flex justify-between items-start flex-wrap gap-xs">
                  <div>
                    <p className="font-title-lg text-title-lg mb-1 font-bold text-on-surface">08:00 ص - مطار الملك خالد (RUH)</p>
                    <p className="font-body-md text-body-md text-outline">الرياض، المملكة العربية السعودية | مبنى 5</p>
                  </div>
                  <div className="text-left">
                    <p className="font-label-md text-label-md font-bold">طيران الرياض | SV 123</p>
                    <p className="font-label-sm text-label-sm text-outline">Airbus A320</p>
                  </div>
                </div>

                {/* Aircraft Details & Amenities */}
                <div className="mt-md bg-surface-container-low rounded-lg p-sm grid grid-cols-2 md:grid-cols-4 gap-sm">
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>event_seat</span>
                    <span className="font-label-sm text-label-sm">32 بوصة (مساحة المقعد)</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary">usb</span>
                    <span className="font-label-sm text-label-sm">منفذ USB شحن</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary">restaurant</span>
                    <span className="font-label-sm text-label-sm">وجبة متضمنة مجاناً</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary">tv</span>
                    <span className="font-label-sm text-label-sm">شاشة ترفيه جوي</span>
                  </div>
                </div>
                <p className="mt-sm font-label-sm text-label-sm text-outline flex items-center gap-xs">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  مدة الرحلة: 1س و 45د
                </p>
              </div>
            </div>

            {/* Layover Warning Bar */}
            <div className="relative z-10 flex items-start gap-md bg-tertiary-fixed text-on-tertiary-fixed p-md rounded-lg mb-lg border-r-4 border-tertiary shadow-sm">
              <span className="material-symbols-outlined text-tertiary shrink-0 mt-0.5">error_outline</span>
              <div>
                <p className="font-label-md text-label-md font-bold">توقف ترانزيت في المنامة، البحرين (BAH)</p>
                <p className="font-body-md text-body-md opacity-90 mt-0.5">مدة الانتظار والتوقف 2س و 15د. يتم نقل الأمتعة والحقائب تلقائياً لوجهتك النهائية دون تدخل منك.</p>
              </div>
            </div>

            {/* Segment 2 */}
            <div className="relative z-10 grid grid-cols-12 gap-base">
              <div className="col-span-1 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">flight_land</span>
                </div>
              </div>
              <div className="col-span-11 pr-sm">
                <div className="flex justify-between items-start flex-wrap gap-xs">
                  <div>
                    <p className="font-title-lg text-title-lg mb-1 font-bold text-on-surface">12:00 م - مطار البحرين الدولي (BAH)</p>
                    <p className="font-body-md text-body-md text-outline">المنامة، البحرين</p>
                  </div>
                  <div className="text-left">
                    <p className="font-label-md text-label-md font-bold">طيران الخليج | GF 504</p>
                  </div>
                </div>
                <div className="mt-md border-t border-dashed border-outline-variant pt-md">
                  <p className="font-title-lg text-title-lg mb-1 font-bold text-primary">01:15 م - مطار دبي الدولي (DXB)</p>
                  <p className="font-body-md text-body-md text-outline">دبي، الإمارات العربية المتحدة | مبنى 3</p>
                </div>
              </div>
            </div>
          </div>

          {/* Baggage Policy Card */}
          <div className="bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm">
            <div className="bg-surface-container px-md py-sm border-b border-outline-variant">
              <h3 className="font-title-lg text-title-lg font-bold text-on-surface">سياسة الأمتعة والحقائب</h3>
            </div>
            <div className="p-md grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="flex items-start gap-md">
                <div className="p-sm bg-primary-fixed rounded-lg shrink-0 text-primary">
                  <span className="material-symbols-outlined">luggage</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md font-bold text-on-surface">حقائب مسجلة للشحن</p>
                  <p className="font-body-md text-body-md text-outline">2 قطعة × 23 كجم (إجمالي 46 كجم)</p>
                  <div className="flex items-center gap-xs text-tertiary mt-xs">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="font-label-sm text-label-sm font-bold">متضمنة مجاناً في السعر</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-md">
                <div className="p-sm bg-primary-fixed rounded-lg shrink-0 text-primary">
                  <span className="material-symbols-outlined">backpack</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md font-bold text-on-surface">أمتعة مقصورة الطائرة</p>
                  <p className="font-body-md text-body-md text-outline">1 قطعة × 7 كجم لكل مسافر</p>
                  <div className="flex items-center gap-xs text-tertiary mt-xs">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="font-label-sm text-label-sm font-bold">متضمنة مجاناً في السعر</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Cabin Experience */}
          <div className="rounded-xl overflow-hidden h-48 relative group shadow-md border border-outline-variant">
            <img 
              alt="Premium Cabin Experience" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAf_mNrSprRMNLnjWexTNwgB6bkpp9J5JqqiuD1okilgqVKDpYzGhuwwLhlfXN2V6q_E_-uMlIbwtGXhtvvk31HH_EdKiSMcSIZ6nZDyjWkYjFu1h8hf8Q6YTVxmvW87XEw2BMgTkpo4fl9Hqe4jhwbvbPKaeqkHhTDxUWbtOMRmcFh-IYoIAly9dV3RYiI2M5pS_eHQG-Ni8mcA2UjADA7VAT3LKKkBAtHh-DoAJ10dkbUzdr2LRctVDt7TKVJMicB7Yl-dqNzandR"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-md">
              <p className="text-white font-title-lg text-title-lg font-bold">استمتع بتجربة سفر فاخرة ومريحة مع أفضل خطوط الطيران في العالم</p>
            </div>
          </div>
        </section>

        {/* Left Panel (30%) - Sticky Booking Panel */}
        <aside className="lg:col-span-3">
          <div className="lg:sticky lg:top-24 flex flex-col gap-md">
            <div className="bg-white rounded-xl border border-outline-variant shadow-lg overflow-hidden">
              <div className="p-md border-b border-outline-variant bg-surface-container-low">
                <label className="block font-label-md text-label-md text-outline mb-sm font-bold">درجة السفر المفضلة</label>
                <select 
                  value={travelClass}
                  onChange={(e) => setTravelClass(e.target.value)}
                  className="w-full bg-white border border-outline-variant rounded-lg p-sm font-label-md text-label-md focus:ring-primary focus:border-primary outline-none cursor-pointer"
                >
                  <option value="سياحية">الدرجة السياحية</option>
                  <option value="رجال الأعمال">درجة رجال الأعمال</option>
                  <option value="الأولى">الدرجة الأولى</option>
                </select>
              </div>
              <div className="p-md flex flex-col gap-sm">
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-body-md text-outline">سعر تذكرة المسافر</span>
                  <span className="font-label-md text-label-md font-medium text-on-surface">{basePrice.toLocaleString()} SAR</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-body-md text-outline">الضرائب والرسوم</span>
                  <span className="font-label-md text-label-md font-medium text-on-surface">{taxes.toLocaleString()} SAR</span>
                </div>
                <div className="border-t border-outline-variant pt-sm mt-sm flex justify-between items-center">
                  <span className="font-title-lg text-title-lg font-bold text-on-surface">السعر الإجمالي</span>
                  <span className="font-headline-md text-headline-md text-primary font-bold">{totalPrice.toLocaleString()} SAR</span>
                </div>
              </div>
              <div className="p-md pt-0">
                <Link 
                  href="/checkout" 
                  className="w-full bg-primary hover:bg-primary-container text-white font-title-lg text-title-lg py-md rounded-lg transition-all active:scale-95 shadow-md flex items-center justify-center font-bold text-center"
                >
                  الاستمرار للحجز
                </Link>
                <p className="text-center font-label-sm text-label-sm text-outline mt-sm flex items-center justify-center gap-xs">
                  <span className="material-symbols-outlined text-sm text-tertiary">lock</span>
                  حجز مشفر وآمن 100%
                </p>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="bg-surface-container-low rounded-xl p-md border border-outline-variant flex flex-col gap-md">
              <div className="flex items-start gap-sm">
                <span className="material-symbols-outlined text-primary shrink-0">verified</span>
                <div>
                  <p className="font-label-md text-label-md font-bold text-on-surface">تأكيد فوري للحجز</p>
                  <p className="font-label-sm text-label-sm text-outline mt-0.5">ستصلك التذكرة والرمز PNR مباشرة</p>
                </div>
              </div>
              <div className="flex items-start gap-sm">
                <span className="material-symbols-outlined text-primary shrink-0">support_agent</span>
                <div>
                  <p className="font-label-md text-label-md font-bold text-on-surface">دعم فني متكامل</p>
                  <p className="font-label-sm text-label-sm text-outline mt-0.5">مساعدتكم في التعديل أو الإلغاء</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant mt-xl">
        <div className="w-full py-lg px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <div className="flex flex-col items-center md:items-start gap-xs">
            <span className="font-headline-md text-headline-md font-extrabold text-primary">سفريات</span>
            <p className="font-label-sm text-label-sm text-outline mt-1">© 2026 سفريات. جميع الحقوق محفوظة.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-md">
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">عن سفريات</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">سياسة الخصوصية</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">الشروط والأحكام</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">اتصل بنا</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">الأسئلة الشائعة</Link>
          </div>
          <div className="flex gap-sm">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-outline-variant text-outline hover:text-primary cursor-pointer transition-colors">
              <span className="material-symbols-outlined">share</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-outline-variant text-outline hover:text-primary cursor-pointer transition-colors">
              <span className="material-symbols-outlined">mail</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
