"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function FlightsPage() {

  return (
    <>
      
<header className="bg-surface-container-lowest shadow-sm sticky top-0 z-50">
<div className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-16">
<div className="flex items-center gap-lg">
<Link href="/">
  <h1 className="font-headline-lg-mobile md:font-headline-lg text-primary font-bold cursor-pointer">سفريات</h1>
</Link>
<nav className="hidden md:flex items-center gap-md">
<Link className="text-primary font-bold border-b-2 border-primary pb-1 font-label-md text-label-md" href="/">رحلات طيران</Link>
<Link className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/hotels">فنادق</Link>
<Link className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/">عروض</Link>
<Link className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/">رحلاتي</Link>
</nav>
</div>
<div className="flex items-center gap-base">
<div className="hidden md:flex items-center gap-sm">
<span className="material-symbols-outlined text-on-surface-variant">language</span>
<span className="font-label-md text-label-md">USD / AR</span>
</div>
<Link href="/signin" className="bg-primary text-on-primary px-md py-xs rounded-lg font-label-md text-label-md active:scale-95 transition-transform text-center flex items-center justify-center">
  تسجيل الدخول
</Link>
</div>
</div>
</header>

<section className="bg-primary-container text-on-primary-container py-base">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-base">
<div className="flex items-center gap-md">
<div className="flex items-center gap-xs">
<span className="material-symbols-outlined text-on-primary-container">flight_takeoff</span>
<span className="font-title-lg text-title-lg">RUH</span>
</div>
<span className="material-symbols-outlined text-on-primary-container rotate-180">arrow_forward</span>
<div className="flex items-center gap-xs">
<span className="material-symbols-outlined text-on-primary-container">flight_land</span>
<span className="font-title-lg text-title-lg">DXB</span>
</div>
<div className="h-6 w-px bg-on-primary-container/30 mx-base hidden md:block"></div>
<div className="flex flex-col md:flex-row md:items-center gap-base">
<span className="font-label-md text-label-md opacity-90">15 أكتوبر - 20 أكتوبر</span>
<span className="font-label-md text-label-md opacity-90">1 مسافر، سياحية</span>
</div>
</div>
<button className="bg-surface-container-lowest text-primary px-md py-xs rounded-full font-label-md text-label-md hover:bg-on-primary transition-colors flex items-center gap-xs">
<span className="material-symbols-outlined text-[18px]">edit</span>
                تعديل البحث
            </button>
</div>
</section>

<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-lg grid grid-cols-1 md:grid-cols-12 gap-lg">

<aside className="md:col-span-3 order-1 md:order-2">
<div className="bg-surface-container-lowest rounded-xl p-md shadow-sm sticky top-24">
<div className="flex justify-between items-center mb-md">
<h3 className="font-title-lg text-title-lg">تصفية النتائج</h3>
<button className="text-primary font-label-sm text-label-sm hover:underline">مسح الكل</button>
</div>

<div className="mb-lg">
<label className="font-label-md text-label-md block mb-sm">نطاق السعر (SAR)</label>
<input className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary" max="5000" min="500" step="100" type="range"/>
<div className="flex justify-between mt-xs">
<span className="font-label-sm text-label-sm text-outline">500</span>
<span className="font-label-sm text-label-sm text-outline">5000+</span>
</div>
</div>

<div className="mb-lg">
<label className="font-label-md text-label-md block mb-sm">عدد التوقفات</label>
<div className="space-y-sm">
<label className="flex items-center gap-base cursor-pointer">
<input className="w-5 h-5 rounded border-outline text-primary focus:ring-primary" type="checkbox"/>
<span className="font-body-md text-body-md">مباشر</span>
</label>
<label className="flex items-center gap-base cursor-pointer">
<input className="w-5 h-5 rounded border-outline text-primary focus:ring-primary" type="checkbox"/>
<span className="font-body-md text-body-md">توقف واحد</span>
</label>
<label className="flex items-center gap-base cursor-pointer">
<input className="w-5 h-5 rounded border-outline text-primary focus:ring-primary" type="checkbox"/>
<span className="font-body-md text-body-md">توقفين أو أكثر</span>
</label>
</div>
</div>

<div className="mb-lg">
<label className="font-label-md text-label-md block mb-sm">خطوط الطيران</label>
<div className="space-y-sm">
<label className="flex items-center gap-base cursor-pointer">
<input className="w-5 h-5 rounded border-outline text-primary focus:ring-primary" type="checkbox"/>
<span className="font-body-md text-body-md">السعودية</span>
</label>
<label className="flex items-center gap-base cursor-pointer">
<input className="w-5 h-5 rounded border-outline text-primary focus:ring-primary" type="checkbox"/>
<span className="font-body-md text-body-md">طيران الإمارات</span>
</label>
<label className="flex items-center gap-base cursor-pointer">
<input className="w-5 h-5 rounded border-outline text-primary focus:ring-primary" type="checkbox"/>
<span className="font-body-md text-body-md">فلاي دبي</span>
</label>
</div>
</div>

<div className="mb-lg">
<label className="font-label-md text-label-md block mb-sm">وقت المغادرة</label>
<div className="grid grid-cols-2 gap-base">
<button className="border border-outline-variant p-base rounded-lg text-center hover:bg-secondary-container transition-colors">
<span className="material-symbols-outlined block mb-xs">wb_twilight</span>
<span className="font-label-sm text-label-sm">الصباح</span>
</button>
<button className="border border-outline-variant p-base rounded-lg text-center hover:bg-secondary-container transition-colors">
<span className="material-symbols-outlined block mb-xs">light_mode</span>
<span className="font-label-sm text-label-sm">الظهيرة</span>
</button>
</div>
</div>
</div>
</aside>

<div className="md:col-span-9 order-2 md:order-1">

<div className="flex bg-surface-container-low rounded-xl p-xs mb-lg overflow-x-auto">
<button className="flex-1 min-w-[120px] bg-surface-container-lowest shadow-sm rounded-lg py-sm px-base flex flex-col items-center">
<span className="font-label-md text-label-md text-primary font-bold">الأرخص</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">1,250 SAR</span>
</button>
<button className="flex-1 min-w-[120px] py-sm px-base flex flex-col items-center hover:bg-surface-container-highest/50 rounded-lg transition-colors">
<span className="font-label-md text-label-md">الأسرع</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">1,890 SAR</span>
</button>
<button className="flex-1 min-w-[120px] py-sm px-base flex flex-col items-center hover:bg-surface-container-highest/50 rounded-lg transition-colors">
<span className="font-label-md text-label-md">الأفضل</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">1,450 SAR</span>
</button>
</div>

<div className="space-y-md">

<div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
<div className="p-md flex flex-col md:flex-row items-center gap-lg">

<div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 items-center gap-md">
<div className="flex items-center gap-md">
<img alt="Airline Logo" className="w-12 h-12 rounded-lg" data-alt="A minimalist vector logo for a premium airline featuring a stylized abstract wing in deep navy blue on a clean white background. The design is modern, professional, and corporate, emphasizing reliability and swift air travel with sharp, precision-cut edges and a high-contrast aesthetic typical of leading global carriers." src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8aiiDVtNzAX5V-PQCxwcGpPbgL0ydohFOBWgxEM-LVPnhF5RR0mSNUd10B2wzeK7NYzutV9yDCJvWSCVuujcsOZQT0IZZa0u1qUA3t_ftsbN99cLVX5ENURZyRwge48cYBkzgsuXi--HdajIiKryEKVPwX5oC9bgd-lqX9vCb7KZSvL_5bXe8RSyFMGJlpCwGL3UWqVpSgMnMztoq5BtaDsKobO8TZsKn-7TG7l8jdSilTUslH_GwwbnNqtCr353SwDylonLL7AF0"/>
<div className="flex flex-col">
<span className="font-title-lg text-title-lg">السعودية</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">SV 123</span>
</div>
</div>
<div className="col-span-2 flex items-center justify-between w-full px-md">
<div className="text-center">
<span className="font-headline-md text-headline-md block">08:00</span>
<span className="font-label-md text-label-md text-outline">RUH</span>
</div>
<div className="flex-1 flex flex-col items-center px-lg">
<span className="font-label-sm text-label-sm text-outline mb-xs">2س 15د</span>
<div className="flight-path-line w-full"></div>
<span className="font-label-sm text-label-sm text-primary mt-xs">مباشر</span>
</div>
<div className="text-center">
<span className="font-headline-md text-headline-md block">10:15</span>
<span className="font-label-md text-label-md text-outline">DXB</span>
</div>
</div>
</div>

<div className="w-full md:w-48 md:border-r border-outline-variant md:pr-lg flex flex-row md:flex-col justify-between md:justify-center items-center gap-base">
<div className="text-right md:text-center">
<span className="font-label-sm text-label-sm text-on-surface-variant">يبدأ من</span>
<div className="font-headline-md text-headline-md text-tertiary">1,250 SAR</div>
</div>
<Link href="/flights/details" className="bg-primary text-on-primary w-full md:w-auto px-xl py-sm rounded-lg font-label-md text-label-md hover:brightness-110 active:scale-95 transition-all text-center flex items-center justify-center">اختيار</Link>
</div>
</div>
<div className="bg-surface-container-low px-md py-xs flex justify-between items-center border-t border-outline-variant">
<div className="flex gap-md">
<span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[16px]">luggage</span> حقيبة يد 7 كجم
                            </span>
<span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[16px]">work</span> حقيبة شحن 23 كجم
                            </span>
</div>
<button className="text-primary font-label-sm text-label-sm flex items-center gap-xs">
                            تفاصيل الرحلة <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
</button>
</div>
</div>

<div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-md transition-shadow">
<div className="p-md flex flex-col md:flex-row items-center gap-lg">
<div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 items-center gap-md">
<div className="flex items-center gap-md">
<img alt="Airline Logo" className="w-12 h-12 rounded-lg" data-alt="A clean, minimalist airline logo featuring elegant red and white typography on a neutral background. The visual style is sophisticated and global, suggesting luxury travel and world-class service. The lighting is soft and even, highlighting the professional corporate identity with a focus on precision and high-velocity travel aesthetics." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFP5RBbD4tRVdieLeHqav9u03HXjnNEcsHUf0eKocSQGY5PIMD6B78IJ5UUPqgo5rGyESQ70N0Zo9AH2u58lgP7A01jOz3pOBhPpIKbTr1te42jLAB0QFQs3UUD3lNW1m0EJg58eGHwAUmH66wgujEA-VO2rZLX0TkXiKbpdQb-FBZxP2fHCAW6DCdszH5satoXWV-ma-VrMxCxVHUcII3qL-esCCtTKxMul6w2g1axa2K_BJhrDJMc5p0Lo89tOSejKWGbF8tV-Kd"/>
<div className="flex flex-col">
<span className="font-title-lg text-title-lg">طيران الإمارات</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">EK 818</span>
</div>
</div>
<div className="col-span-2 flex items-center justify-between w-full px-md">
<div className="text-center">
<span className="font-headline-md text-headline-md block">14:30</span>
<span className="font-label-md text-label-md text-outline">RUH</span>
</div>
<div className="flex-1 flex flex-col items-center px-lg">
<span className="font-label-sm text-label-sm text-outline mb-xs">2س 00د</span>
<div className="flight-path-line w-full"></div>
<span className="font-label-sm text-label-sm text-primary mt-xs">مباشر</span>
</div>
<div className="text-center">
<span className="font-headline-md text-headline-md block">16:30</span>
<span className="font-label-md text-label-md text-outline">DXB</span>
</div>
</div>
</div>
<div className="w-full md:w-48 md:border-r border-outline-variant md:pr-lg flex flex-row md:flex-col justify-between md:justify-center items-center gap-base">
<div className="text-right md:text-center">
<span className="font-label-sm text-label-sm text-on-surface-variant">يبدأ من</span>
<div className="font-headline-md text-headline-md text-tertiary">1,890 SAR</div>
</div>
<Link href="/flights/details" className="bg-primary text-on-primary w-full md:w-auto px-xl py-sm rounded-lg font-label-md text-label-md hover:brightness-110 active:scale-95 transition-all text-center flex items-center justify-center">اختيار</Link>
</div>
</div>
<div className="bg-surface-container-low px-md py-xs flex justify-between items-center border-t border-outline-variant">
<div className="flex gap-md">
<span className="flex items-center gap-xs font-label-sm text-label-sm text-error">
<span className="material-symbols-outlined text-[16px]">event_busy</span> غير مستردة
                            </span>
<span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[16px]">restaurant</span> وجبة مشمولة
                            </span>
</div>
<button className="text-primary font-label-sm text-label-sm flex items-center gap-xs">
                            تفاصيل الرحلة <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
</button>
</div>
</div>

<div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-md transition-shadow">
<div className="p-md flex flex-col md:flex-row items-center gap-lg">
<div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 items-center gap-md">
<div className="flex items-center gap-md">
<img alt="Airline Logo" className="w-12 h-12 rounded-lg" data-alt="A modern airline corporate logo in vibrant sky blue and white. The design uses bold, contemporary typography and a clean geometric symbol representing flight and speed. The overall aesthetic is energetic and accessible, set against a bright, airy background that evokes the feeling of clear open skies and modern air travel efficiency." src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7Zb2BQZ-KPZ_7cWnoCF9M1ht0F4uEo8wI9ZxlnIqVqqJ7WyL2JKGnu9g_c46hZiG5bZWYsVPIz64DmGuZzBxOmuDOsFVJ2YcQzaeDrQjPutNcS3l4LkmIKKQ2M-4Zk_S2LcsGPGFFqPoa7Nmg-FepPYYfxabGMZtLZP5KR-L621hARYOie5Mrem-pOgI002tqZPPAaGgcVbdmNUIhC3ckQTn57Rct2hNzaOqVEM1cHvEv9-lGV9NljQpqIvENVOhkT6bSumXk6koq"/>
<div className="flex flex-col">
<span className="font-title-lg text-title-lg">فلاي دبي</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">FZ 405</span>
</div>
</div>
<div className="col-span-2 flex items-center justify-between w-full px-md">
<div className="text-center">
<span className="font-headline-md text-headline-md block">11:15</span>
<span className="font-label-md text-label-md text-outline">RUH</span>
</div>
<div className="flex-1 flex flex-col items-center px-lg">
<span className="font-label-sm text-label-sm text-outline mb-xs">5س 40د</span>
<div className="relative w-full h-[2px] bg-outline-variant">
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-error rounded-full" title="Stop in Bahrain"></div>
<div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full"></div>
<div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full"></div>
</div>
<span className="font-label-sm text-label-sm text-error mt-xs">1 توقف (BAH)</span>
</div>
<div className="text-center">
<span className="font-headline-md text-headline-md block">16:55</span>
<span className="font-label-md text-label-md text-outline">DXB</span>
</div>
</div>
</div>
<div className="w-full md:w-48 md:border-r border-outline-variant md:pr-lg flex flex-row md:flex-col justify-between md:justify-center items-center gap-base">
<div className="text-right md:text-center">
<span className="font-label-sm text-label-sm text-on-surface-variant">يبدأ من</span>
<div className="font-headline-md text-headline-md text-tertiary">980 SAR</div>
</div>
<Link href="/flights/details" className="bg-primary text-on-primary w-full md:w-auto px-xl py-sm rounded-lg font-label-md text-label-md hover:brightness-110 active:scale-95 transition-all text-center flex items-center justify-center">اختيار</Link>
</div>
</div>
<div className="bg-surface-container-low px-md py-xs flex justify-between items-center border-t border-outline-variant">
<div className="flex gap-md">
<span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[16px]">wifi</span> واي فاي مجاني
                            </span>
</div>
<button className="text-primary font-label-sm text-label-sm flex items-center gap-xs">
                            تفاصيل الرحلة <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
</button>
</div>
</div>
</div>

<div className="mt-xl flex flex-col items-center">
<button className="border border-primary text-primary px-xl py-base rounded-lg font-title-lg text-title-lg hover:bg-secondary-container transition-colors active:scale-95">
                    تحميل المزيد من الرحلات
                </button>
<p className="mt-base font-label-sm text-label-sm text-outline">عرض 1-15 من أصل 48 رحلة متوفرة</p>
</div>
</div>
</main>

<footer className="bg-surface-container border-t border-outline-variant mt-xl">
<div className="w-full py-lg px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-lg">
<div className="flex flex-col gap-base">
<h2 className="font-headline-md text-headline-md font-extrabold text-primary">سفريات</h2>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md md:max-w-xl">شريكك الموثوق لاستكشاف العالم بكل سهولة وراحة. حجز طيران وفنادق بأفضل الأسعار.</p>
</div>
<div className="flex flex-wrap gap-xl">
<div className="flex flex-col gap-sm">
<span className="font-label-md text-label-md font-bold text-on-surface">عن سفريات</span>
<Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary hover:underline" href="/">من نحن</Link>
<Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary hover:underline" href="/">اتصل بنا</Link>
</div>
<div className="flex flex-col gap-sm">
<span className="font-label-md text-label-md font-bold text-on-surface">القانونية</span>
<Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary hover:underline" href="/">سياسة الخصوصية</Link>
<Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary hover:underline" href="/">الشروط والأحكام</Link>
</div>
</div>
</div>
<div className="border-t border-outline-variant/30 py-md px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
<p className="font-label-sm text-label-sm text-on-surface-variant">© 2024 سفريات. جميع الحقوق محفوظة.</p>
<div className="flex gap-md">
<span className="material-symbols-outlined text-outline">social_leaderboard</span>
<span className="material-symbols-outlined text-outline">alternate_email</span>
<span className="material-symbols-outlined text-outline">share</span>
</div>
</div>
</footer>
    </>
  );
}
