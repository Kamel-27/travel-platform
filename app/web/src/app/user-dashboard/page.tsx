"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function UserDashboardPage() {

  return (
    <>
      
<header className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm sticky top-0 z-50">
<nav className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-16">
<div className="flex items-center gap-lg">
<span className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary">Safariyat</span>
<div className="hidden md:flex gap-md">
<Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/">رحلات طيران</Link>
<Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/">فنادق</Link>
<Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/">عروض</Link>
<Link className="text-primary dark:text-inverse-primary font-bold border-b-2 border-primary dark:border-inverse-primary pb-1 font-label-md text-label-md" href="/">رحلاتي</Link>
</div>
</div>
<div className="flex items-center gap-sm">
<div className="flex items-center gap-xs text-on-surface-variant">
<span className="material-symbols-outlined" data-icon="language">language</span>
<span className="material-symbols-outlined" data-icon="currency_exchange">currency_exchange</span>
<span className="material-symbols-outlined" data-icon="notifications">notifications</span>
</div>
<div className="h-10 w-10 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden border border-outline-variant">
<img alt="صورة الملف الشخصي للمستخدم" className="h-full w-full object-cover" data-alt="A professional close-up headshot of a middle-aged man with a friendly expression, set against a blurred, high-end office background. The lighting is soft and flattering, highlighting the clean textures of his skin and sharp attire. The overall aesthetic is corporate yet approachable, using a palette of soft whites and deep navy blues to align with a premium financial and travel service identity." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrvws9yeAis6sCOfjvXVGmS66gjPbkYYj7QhGqou3a9cmBBfpKisviQZbs4bkVTrvNi66BJn78dPBPXH0S0BUgVWDoNTNqP-kac4wmOKd8ylzgMOhv1ifUGIMWAfrw-mr1lmqd_k8w-1wv0t9wizdKLshkk2F2pj4ijDmbuwfEWswKHRoskdsaMcW6HTLBu2RNz8jtSgHoHb23qUox1CbzcZqakaKuv7YNznxfxrmEJAajEQ1usswNwmXU90eIcj1Ls5S9vH0GoOVR"/>
</div>
</div>
</nav>
</header>
<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-lg grid grid-cols-1 md:grid-cols-12 gap-lg">

<aside className="md:col-span-3">
<div className="bg-surface-container-lowest rounded-xl p-md shadow-sm border border-outline-variant/30 sticky top-24">
<nav className="flex flex-col gap-base">
<Link className="flex items-center gap-sm p-sm rounded-lg bg-primary/10 text-primary font-bold transition-all" href="/">
<span className="material-symbols-outlined" data-icon="event_available">event_available</span>
<span className="font-label-md text-label-md">حجوزاتي</span>
</Link>
<Link className="flex items-center gap-sm p-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all" href="/">
<span className="material-symbols-outlined" data-icon="person">person</span>
<span className="font-label-md text-label-md">الملف الشخصي</span>
</Link>
<Link className="flex items-center gap-sm p-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all" href="/">
<span className="material-symbols-outlined" data-icon="account_balance_wallet">account_balance_wallet</span>
<span className="font-label-md text-label-md">المحفظة</span>
</Link>
<Link className="flex items-center gap-sm p-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all" href="/">
<span className="material-symbols-outlined" data-icon="settings">settings</span>
<span className="font-label-md text-label-md">الإعدادات</span>
</Link>
<div className="h-px bg-outline-variant my-sm"></div>
<Link className="flex items-center gap-sm p-sm rounded-lg text-error hover:bg-error-container/20 transition-all" href="/">
<span className="material-symbols-outlined" data-icon="logout">logout</span>
<span className="font-label-md text-label-md">تسجيل الخروج</span>
</Link>
</nav>
</div>
</aside>

<div className="md:col-span-9 space-y-lg">

<section className="flex flex-col md:flex-row md:items-end justify-between gap-base">
<div>
<h1 className="font-headline-lg text-headline-lg text-primary">أهلاً بك، أحمد</h1>
<p className="font-body-md text-body-md text-on-surface-variant">لديك رحلتان قادمتان هذا الشهر.</p>
</div>
<div className="flex gap-sm">
<button className="bg-primary text-white px-md py-sm rounded-lg font-label-md text-label-md shadow-sm hover:scale-98 active:scale-95 transition-transform flex items-center gap-xs">
<span className="material-symbols-outlined text-[20px]" data-icon="add">add</span>
                        حجز جديد
                    </button>
</div>
</section>

<section>
<div className="flex items-center justify-between mb-md">
<h2 className="font-title-lg text-title-lg flex items-center gap-xs">
<span className="material-symbols-outlined text-primary" data-icon="flight_takeoff">flight_takeoff</span>
                        الرحلات القادمة
                    </h2>
</div>
<div className="space-y-md">

<div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 hover:border-primary/50 transition-colors group">
<div className="flex flex-col md:flex-row">
<div className="md:w-1/3 relative h-48 md:h-auto overflow-hidden">
<img alt="فندق في دبي" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="A breathtaking view of a luxury rooftop hotel pool overlooking the Burj Khalifa and the glowing Dubai skyline at twilight. The lighting is sophisticated, with warm interior glows contrasting against the cool violet sky. The scene is crisp and high-definition, embodying an elite travel experience with modern architecture and shimmering water textures." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDkrpY6jxBKSUGdwmx5sAq0p3VAQ0qlHC3a_Fev16_BxJ7RuECH_fCkTO0iPxAY7sNHF43ETm3JbMu-XeUe4nongw63j2o1mVXft5HpFXchdlwAooDmJqLaproNLiLxAEnBiodaH02o3KXX9ODY7YYQrcZHEzRgq-oSuE70PZ0uAxWZ9Cm-6lcetzKnIyYFkStxl4qwixom6BjO3V0l3mZqbIvSm9nnZ4-looJQxQKGum6UccIWn_x0mp7rKh1krkE5pnot1V9gbmc0"/>
<span className="absolute top-sm right-sm bg-primary text-white font-label-sm text-label-sm px-sm py-1 rounded-full flex items-center gap-xs">
<span className="material-symbols-outlined text-[14px]" data-icon="check_circle" data-weight="fill">check_circle</span>
                                    مؤكد
                                </span>
</div>
<div className="md:w-2/3 p-md flex flex-col justify-between">
<div className="flex justify-between items-start">
<div>
<h3 className="font-headline-md text-headline-md">فندق جميرا بيتش</h3>
<p className="text-on-surface-variant font-label-md flex items-center gap-xs mt-1">
<span className="material-symbols-outlined text-[18px]" data-icon="location_on">location_on</span>
                                            دبي، الإمارات العربية المتحدة
                                        </p>
</div>
<div className="text-left">
<p className="text-tertiary font-headline-md text-headline-md">1,250 USD</p>
<p className="text-on-surface-variant font-label-sm">لليلة الواحدة</p>
</div>
</div>
<div className="mt-lg flex flex-wrap gap-lg border-t border-outline-variant/20 pt-md">
<div className="flex flex-col">
<span className="text-on-surface-variant font-label-sm">تاريخ الوصول</span>
<span className="font-label-md text-primary">15 أكتوبر 2024</span>
</div>
<div className="flex flex-col">
<span className="text-on-surface-variant font-label-sm">تاريخ المغادرة</span>
<span className="font-label-md text-primary">20 أكتوبر 2024</span>
</div>
<div className="flex flex-col">
<span className="text-on-surface-variant font-label-sm">رقم الحجز</span>
<span className="font-label-md">#SF-902341</span>
</div>
</div>
<div className="mt-md flex justify-end gap-sm">
<button className="text-primary border border-primary px-md py-base rounded-lg font-label-md hover:bg-primary/5 transition-colors">إدارة الحجز</button>
<button className="bg-primary text-white px-md py-base rounded-lg font-label-md hover:opacity-90 transition-opacity">تحميل التذكرة</button>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/30">
<div className="flex flex-col md:flex-row">
<div className="md:w-1/3 relative h-48 md:h-auto overflow-hidden">
<img alt="طائرة في الجو" className="h-full w-full object-cover" data-alt="A modern commercial aircraft soaring through a clear azure sky during the golden hour. The sunlight reflects off the metallic surface of the plane, creating a warm, vibrant glow. Below, soft, wispy clouds create a sense of altitude and freedom. The composition is dynamic and clean, focused on the elegance of modern flight and the thrill of discovery." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJsWmzqbvLCt_J8ineoskfRF_arju7vbDp2F9Tb5TGdLcWJNBwLZ4S0eBTmv7S64EA4Z55m1O838nrg-PD3c3EW5ozorEGnEicpEzyWLLOQrHRoYe4k_q4v9nTGFOEMotMusiNiGz-w3Vmtngf6GGcYSwxiLWwFex6zWHI74kH40JVJlFQ5roqlat5XeNrzz_zNVVV-TVZCnm1MjjCWNxIJbT5z1WYYMKsKkhGXgSWZPlP-5DXNqr1LmyYqHk7NwxGWVidmjpWFYiY"/>
<span className="absolute top-sm right-sm bg-tertiary-container text-white font-label-sm text-label-sm px-sm py-1 rounded-full flex items-center gap-xs">
<span className="material-symbols-outlined text-[14px]" data-icon="hourglass_empty">hourglass_empty</span>
                                    قيد الانتظار
                                </span>
</div>
<div className="md:w-2/3 p-md flex flex-col justify-between">
<div className="flex justify-between items-start">
<div>
<h3 className="font-headline-md text-headline-md">رحلة: الرياض (RUH) إلى لندن (LHR)</h3>
<p className="text-on-surface-variant font-label-md flex items-center gap-xs mt-1">
<span className="material-symbols-outlined text-[18px]" data-icon="flight_takeoff">flight_takeoff</span>
                                            الخطوط الجوية السعودية - الدرجة الأولى
                                        </p>
</div>
<div className="text-left">
<p className="text-tertiary font-headline-md text-headline-md">3,450 USD</p>
<p className="text-on-surface-variant font-label-sm">ذهاب وعودة</p>
</div>
</div>
<div className="mt-lg grid grid-cols-2 md:grid-cols-4 gap-md border-t border-outline-variant/20 pt-md">
<div className="flex flex-col">
<span className="text-on-surface-variant font-label-sm">المغادرة</span>
<span className="font-label-md text-primary">05 نوفمبر، 08:30</span>
</div>
<div className="flex flex-col">
<span className="text-on-surface-variant font-label-sm">الوصول</span>
<span className="font-label-md text-primary">05 نوفمبر، 14:15</span>
</div>
<div className="flex flex-col">
<span className="text-on-surface-variant font-label-sm">رقم الرحلة</span>
<span className="font-label-md">SV 115</span>
</div>
<div className="flex flex-col">
<span className="text-on-surface-variant font-label-sm">الحالة</span>
<span className="font-label-md text-tertiary-container">بانتظار الدفع</span>
</div>
</div>
<div className="mt-md flex justify-end gap-sm">
<button className="text-error border border-error px-md py-base rounded-lg font-label-md hover:bg-error-container/10 transition-colors">إلغاء الطلب</button>
<button className="bg-tertiary text-white px-md py-base rounded-lg font-label-md hover:opacity-90 transition-opacity">إكمال الدفع</button>
</div>
</div>
</div>
</div>
</div>
</section>

<section>
<div className="flex items-center justify-between mb-md pt-lg">
<h2 className="font-title-lg text-title-lg flex items-center gap-xs">
<span className="material-symbols-outlined text-outline" data-icon="history">history</span>
                        الرحلات السابقة
                    </h2>
<Link className="text-primary font-label-md hover:underline transition-all" href="/">عرض الكل</Link>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-md">

<div className="bg-surface-container-high/50 rounded-xl p-md border border-outline-variant/30 flex items-center gap-md opacity-80 hover:opacity-100 transition-opacity">
<div className="h-16 w-16 rounded-lg overflow-hidden bg-white shrink-0">
<img alt="منتجع في المالديف" className="h-full w-full object-cover" data-alt="A serene aerial view of a luxury overwater bungalow resort in the Maldives. The crystal-clear turquoise waters reveal vibrant coral reefs below. The scene is bright and airy, using a soft tropical palette. The lighting is high-key midday sun, emphasizing the purity and tranquility of the paradise setting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDyEdlTkxpTMejcl1-LxwD9Zs5QPrwopYiPFvw5CR3ol3uJk5-TONvNK0zf40IsP4Z3fzB3FPt02IIqxtta0UeXeC9D24WnaOyNb_Wj1vIowe2w4ViXFfPgG91tPgU9YrDbDEun8m0azA2fVWMgARNeJ_mimhQtKgPFupJevR73rcuduDJ1KI3cNl_m5SCEGI87JRcvpmyzyV-yDZ1fUc31nII6gVR38Pj4RrH4itAi1KrWnad4clgFswPM-lb6iFly8fVc8LhrvgXz"/>
</div>
<div className="flex-grow">
<div className="flex justify-between items-start">
<h4 className="font-label-md font-bold">منتجع جزر المالديف</h4>
<span className="text-outline font-label-sm">تمت</span>
</div>
<p className="text-on-surface-variant font-label-sm">أغسطس 2024 • 7 ليالي</p>
</div>
<span className="material-symbols-outlined text-outline" data-icon="chevron_left">chevron_left</span>
</div>

<div className="bg-surface-container-high/50 rounded-xl p-md border border-outline-variant/30 flex items-center gap-md opacity-80 hover:opacity-100 transition-opacity">
<div className="h-16 w-16 rounded-lg overflow-hidden bg-white shrink-0">
<img alt="باريس" className="h-full w-full object-cover grayscale" data-alt="A classic Parisian street scene featuring the Eiffel Tower in the far background. The architecture of the Haussmann buildings is elegant, bathed in the soft, warm light of a summer morning. The atmosphere is romantic and sophisticated, utilizing a muted, pastel-toned color palette with subtle pops of French blue." src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-DzKDrxtIFnuvajb3H3gb0__ubo1gS1H6UysmsWMXogFFd7_McGk2KC04cFm0Nen1J5KZJguYK5Bz5obk3idkBXz-0VHX1c9WQUshprTxr6_Gzrok6isaYozlmn6u4icM1d2hVWZIU5-NU-gpyJ3IzhV08AyKIT156xdsW2dDuiXLnR2Wact256zN_d9IsSGG9MKKOfMNCmaDrBffqGF-LRNosMdnl3fg1jXjeETPVValvGbl5v44R0JrQu07vQAwLCQsYGkfzSIS"/>
</div>
<div className="flex-grow">
<div className="flex justify-between items-start">
<h4 className="font-label-md font-bold">رحلة باريس</h4>
<span className="text-error font-label-sm">ملغاة</span>
</div>
<p className="text-on-surface-variant font-label-sm">يوليو 2024 • طيران فقط</p>
</div>
<span className="material-symbols-outlined text-outline" data-icon="chevron_left">chevron_left</span>
</div>
</div>
</section>
</div>
</main>

<footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant">
<div className="w-full py-lg px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
<div className="text-center md:text-right">
<span className="font-headline-md text-headline-md font-extrabold text-primary dark:text-primary-fixed-dim">سفريات</span>
<p className="font-label-sm text-label-sm text-on-surface-variant mt-xs">© 2024 سفريات. جميع الحقوق محفوظة.</p>
</div>
<div className="flex flex-wrap justify-center gap-md">
<Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">عن سفريات</Link>
<Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">سياسة الخصوصية</Link>
<Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">الشروط والأحكام</Link>
<Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">اتصل بنا</Link>
<Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">الأسئلة الشائعة</Link>
</div>
</div>
</footer>

<div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant flex justify-around py-sm z-50">
<Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/">
<span className="material-symbols-outlined" data-icon="home">home</span>
<span className="text-[10px] font-medium">الرئيسية</span>
</Link>
<Link className="flex flex-col items-center gap-xs text-primary" href="/">
<span className="material-symbols-outlined" data-icon="event_note" data-weight="fill">event_note</span>
<span className="text-[10px] font-bold">رحلاتي</span>
</Link>
<Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/">
<span className="material-symbols-outlined" data-icon="search">search</span>
<span className="text-[10px] font-medium">استكشف</span>
</Link>
<Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/">
<span className="material-symbols-outlined" data-icon="person">person</span>
<span className="text-[10px] font-medium">حسابي</span>
</Link>
</div>
    </>
  );
}
