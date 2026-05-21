"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function DashboardOverviewPage() {

  return (
    <>
      <div className="flex h-screen overflow-hidden">

<aside className="w-64 flex-shrink-0 bg-surface-container-lowest border-l border-outline-variant hidden md:flex flex-col z-50">
<div className="p-md h-16 flex items-center justify-center">
<span className="font-headline-md text-headline-md font-extrabold text-primary">سفريات</span>
</div>
<nav className="flex-1 px-base mt-md space-y-xs overflow-y-auto custom-scrollbar">
<Link className="flex items-center gap-base px-md py-sm rounded-lg sidebar-active transition-all group" href="/">
<span className="material-symbols-outlined text-[20px]">dashboard</span>
<span className="font-label-md text-label-md">نظرة عامة</span>
</Link>
<Link className="flex items-center gap-base px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container transition-all group" href="/">
<span className="material-symbols-outlined text-[20px]">calendar_month</span>
<span className="font-label-md text-label-md">الحجوزات</span>
</Link>
<Link className="flex items-center gap-base px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container transition-all group" href="/">
<span className="material-symbols-outlined text-[20px]">group</span>
<span className="font-label-md text-label-md">العملاء</span>
</Link>
<Link className="flex items-center gap-base px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container transition-all group" href="/">
<span className="material-symbols-outlined text-[20px]">flight</span>
<span className="font-label-md text-label-md">إدارة الرحلات</span>
</Link>
<Link className="flex items-center gap-base px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container transition-all group" href="/">
<span className="material-symbols-outlined text-[20px]">hotel</span>
<span className="font-label-md text-label-md">إدارة الفنادق</span>
</Link>
<Link className="flex items-center gap-base px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container transition-all group" href="/">
<span className="material-symbols-outlined text-[20px]">bar_chart</span>
<span className="font-label-md text-label-md">التقارير</span>
</Link>
</nav>
<div className="p-md border-t border-outline-variant">
<div className="flex items-center gap-base">
<div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant">
<img alt="Profile" className="w-full h-full object-cover" data-alt="A professional headshot of a middle-aged Arab businessman in a sleek, modern office environment. He is wearing a sharp, tailored blue suit with a crisp white shirt, exuding confidence and leadership. The lighting is soft and cinematic, with a shallow depth of field focusing on his friendly yet professional expression. The overall atmosphere is clean, corporate, and high-end." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpwAWfUjoVTvgWkuwRu5wqhKUNXu1eRox1dAVt2nkjvPJO7__EeZTKjWcdPhyKa-fsfVxOnhQp6ggdhjFFJVHt4hTNEqok3pn3_oSwZVfq2BJlhS4HE-318pLYQGlStYP7shY3MujZCpZx2VHG_Zmw_bj25QH1VoTpB7INuGE0vMTX2HLhalXPc_0HSscdwmUjTZ4LCz-YgXIAJgjoKWGwDMLSNT7io7jIuZVbOFW2fRh4oog2dWtueLWLCc8abNq1vz4YUe2HL6Om"/>
</div>
<div>
<p className="font-label-md text-label-md text-on-surface">أحمد منصور</p>
<p className="font-label-sm text-label-sm text-on-surface-variant">مدير النظام</p>
</div>
</div>
</div>
</aside>

<main className="flex-1 flex flex-col overflow-hidden">

<header className="h-16 bg-surface-container-lowest shadow-sm flex items-center justify-between px-md md:px-lg z-40">
<div className="flex items-center gap-md">
<button className="md:hidden p-base text-on-surface">
<span className="material-symbols-outlined">menu</span>
</button>
<h1 className="font-headline-md text-headline-md text-on-surface">نظرة عامة</h1>
</div>
<div className="flex items-center gap-base">
<div className="hidden md:flex items-center bg-surface-container rounded-full px-md py-xs border border-outline-variant">
<span className="material-symbols-outlined text-outline">search</span>
<input className="bg-transparent border-none focus:ring-0 text-label-md w-64" placeholder="بحث في النظام..." type="text"/>
</div>
<button className="p-base relative text-on-surface-variant hover:text-primary transition-colors">
<span className="material-symbols-outlined">notifications</span>
<span className="absolute top-2 left-2 w-2 h-2 bg-error rounded-full border-2 border-surface-container-lowest"></span>
</button>
<button className="p-base text-on-surface-variant hover:text-primary transition-colors">
<span className="material-symbols-outlined">settings</span>
</button>
</div>
</header>

<div className="flex-1 overflow-y-auto p-md md:p-lg space-y-lg custom-scrollbar">

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">

<div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant hover:shadow-md transition-shadow group">
<div className="flex justify-between items-start mb-base">
<div className="p-sm bg-primary-container text-on-primary-container rounded-lg">
<span className="material-symbols-outlined">payments</span>
</div>
<span className="text-tertiary font-label-sm flex items-center gap-xs">
<span className="material-symbols-outlined text-sm">trending_up</span>
                                +12%
                            </span>
</div>
<p className="text-on-surface-variant font-label-md text-label-md">إجمالي الإيرادات</p>
<h3 className="text-on-surface font-headline-lg text-headline-lg">45,230 $</h3>
</div>

<div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant hover:shadow-md transition-shadow">
<div className="flex justify-between items-start mb-base">
<div className="p-sm bg-secondary-container text-on-secondary-container rounded-lg">
<span className="material-symbols-outlined">confirmation_number</span>
</div>
<span className="text-tertiary font-label-sm flex items-center gap-xs">
<span className="material-symbols-outlined text-sm">trending_up</span>
                                +5%
                            </span>
</div>
<p className="text-on-surface-variant font-label-md text-label-md">إجمالي الحجوزات</p>
<h3 className="text-on-surface font-headline-lg text-headline-lg">1,280</h3>
</div>

<div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant hover:shadow-md transition-shadow">
<div className="flex justify-between items-start mb-base">
<div className="p-sm bg-tertiary-fixed text-on-tertiary-fixed rounded-lg">
<span className="material-symbols-outlined">person_add</span>
</div>
<span className="text-error font-label-sm flex items-center gap-xs">
<span className="material-symbols-outlined text-sm">trending_down</span>
                                -2%
                            </span>
</div>
<p className="text-on-surface-variant font-label-md text-label-md">المستخدمين النشطين</p>
<h3 className="text-on-surface font-headline-lg text-headline-lg">8,420</h3>
</div>

<div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant hover:shadow-md transition-shadow">
<div className="flex justify-between items-start mb-base">
<div className="p-sm bg-outline-variant text-on-surface rounded-lg">
<span className="material-symbols-outlined">auto_graph</span>
</div>
<span className="text-tertiary font-label-sm flex items-center gap-xs">
<span className="material-symbols-outlined text-sm">trending_up</span>
                                +8%
                            </span>
</div>
<p className="text-on-surface-variant font-label-md text-label-md">معدل التحويل</p>
<h3 className="text-on-surface font-headline-lg text-headline-lg">4.2%</h3>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">

<div className="lg:col-span-2 bg-surface-container-lowest p-md md:p-lg rounded-xl shadow-sm border border-outline-variant">
<div className="flex items-center justify-between mb-lg">
<h2 className="font-title-lg text-title-lg text-on-surface">اتجاهات الإيرادات</h2>
<select className="bg-surface-container border-none rounded-lg text-label-sm font-label-sm px-md focus:ring-primary">
<option>آخر 30 يوم</option>
<option>آخر 6 أشهر</option>
<option>هذا العام</option>
</select>
</div>
<div className="h-64 flex items-end justify-between gap-base px-base relative">

<div className="group relative flex-1 flex flex-col items-center gap-base">
<div className="w-full bg-secondary-fixed rounded-t-md transition-all group-hover:bg-primary h-[40%]"></div>
<span className="text-label-sm text-on-surface-variant">سبت</span>
</div>
<div className="group relative flex-1 flex flex-col items-center gap-base">
<div className="w-full bg-secondary-fixed rounded-t-md transition-all group-hover:bg-primary h-[60%]"></div>
<span className="text-label-sm text-on-surface-variant">أحد</span>
</div>
<div className="group relative flex-1 flex flex-col items-center gap-base">
<div className="w-full bg-secondary-fixed rounded-t-md transition-all group-hover:bg-primary h-[85%]"></div>
<span className="text-label-sm text-on-surface-variant">اثنين</span>
</div>
<div className="group relative flex-1 flex flex-col items-center gap-base">
<div className="w-full bg-secondary-fixed rounded-t-md transition-all group-hover:bg-primary h-[55%]"></div>
<span className="text-label-sm text-on-surface-variant">ثلاثاء</span>
</div>
<div className="group relative flex-1 flex flex-col items-center gap-base">
<div className="w-full bg-primary rounded-t-md transition-all h-[95%]"></div>
<span className="text-label-sm text-on-surface-variant font-bold">أربعاء</span>
</div>
<div className="group relative flex-1 flex flex-col items-center gap-base">
<div className="w-full bg-secondary-fixed rounded-t-md transition-all group-hover:bg-primary h-[70%]"></div>
<span className="text-label-sm text-on-surface-variant">خميس</span>
</div>
<div className="group relative flex-1 flex flex-col items-center gap-base">
<div className="w-full bg-secondary-fixed rounded-t-md transition-all group-hover:bg-primary h-[45%]"></div>
<span className="text-label-sm text-on-surface-variant">جمعة</span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-md md:p-lg rounded-xl shadow-sm border border-outline-variant flex flex-col">
<h2 className="font-title-lg text-title-lg text-on-surface mb-lg">أفضل الوجهات</h2>
<div className="space-y-md flex-1">
<div className="flex items-center gap-md">
<div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
<img alt="Dubai" className="w-full h-full object-cover" data-alt="A high-altitude aerial view of the Dubai Marina skyline at dusk. The city is illuminated with countless golden and blue lights, with the twisted architecture of skyscrapers reflecting on the Persian Gulf water. The lighting is dramatic, with a warm sunset glow on the horizon. The style is professional travel photography, sharp and vibrant." src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5gCt2GZaaKipesNg9RTvicOj_gRl-n87L-53q3mJVo-cAGULGzIwx84fsaJvn_QtrzzEliQs6fYGsU9n2p9zz0dtg2bv3qJG6ero-sDf-PjTCCrSK2kzLTzwcCy3juJzPv8gimqfr6nmq1XZ_cfl1NYkOhRzvcil6TZzKavI5taJPQdxhS3YRQxUbnLMq2Z62SQgbtbtAsn6HQ-hPcev2-D2zxY_t7FRIM6-Zf-owmT1nDmJlxCaLKhJ_LUM-axJ_GUGBlkcEpfFJ"/>
</div>
<div className="flex-1">
<p className="font-label-md text-label-md text-on-surface">دبي، الإمارات</p>
<div className="w-full bg-surface-container rounded-full h-2 mt-xs">
<div className="bg-primary h-full rounded-full w-[85%]"></div>
</div>
</div>
<span className="text-label-sm text-on-surface-variant">85%</span>
</div>
<div className="flex items-center gap-md">
<div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
<img alt="Riyadh" className="w-full h-full object-cover" data-alt="A cinematic capture of Riyadh's Kingdom Centre at night. The iconic silver skyscraper stands tall against a clear dark blue sky, with city lights stretching out below. The lighting highlights the metallic textures of the building. The image is sophisticated and modern, reflecting the rapid urban growth and luxury of the Saudi capital." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmzPWSlgT1IukkhcYkffz9JVCtKezCe8DXhvZcc5dRmb-o7bO66ROskKKwBQb_Dfmex7EtJCD0kvzR0OWCSKxx2D3Hu10lPFyWBEotDwTmr1L0Za4g2qhBPC9C83_H08ujeItBPuaSWV2t6L0ezUJWFKw3Hn4DPTi8miCPCrH63CZjpoGo-k6ZFKGka5tJBhgVXBApFmWqVzrsfuaiZe4qp_PKIQ2Lowjl27d_G42dDQF0vJFhSkYxYhVUfGNQ5Tyfid9ud_pHLpI0"/>
</div>
<div className="flex-1">
<p className="font-label-md text-label-md text-on-surface">الرياض، السعودية</p>
<div className="w-full bg-surface-container rounded-full h-2 mt-xs">
<div className="bg-primary h-full rounded-full w-[72%]"></div>
</div>
</div>
<span className="text-label-sm text-on-surface-variant">72%</span>
</div>
<div className="flex items-center gap-md">
<div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
<img alt="Istanbul" className="w-full h-full object-cover" data-alt="A breathtaking view of Istanbul's Hagia Sophia and the Bosphorus Strait during the golden hour. The ancient architecture is bathed in warm sunlight, with the blue water of the strait visible in the background. Seagulls soar through the air, adding a sense of movement. The style is classic travel photography with high saturation and warm tones." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrowrH0A1mVcFHrSOs4Ud1uYkCPAW6pOdIIgCn7zWJZ0O26eZXLXjAZM-M8hctHMPVLWzv8gaGMo9IbruMsx-x9sUlcP7IHGVL1stpwyQU6rnPyfK9toxNRXLfT6ZrxBXx5gd-DjTT7OySVVxQsY6Thgy_SdjRF_0WQnWyxnOP6_Q8PORALS_l83xUU0vZQtMk3DtlNH54oXxyXMTGlpOwQp6DiWehj1A3Xj5jHu9u6G3diUHixlTvpJt8iWvqlVAfKWPSs-rtn95U"/>
</div>
<div className="flex-1">
<p className="font-label-md text-label-md text-on-surface">إسطنبول، تركيا</p>
<div className="w-full bg-surface-container rounded-full h-2 mt-xs">
<div className="bg-primary h-full rounded-full w-[60%]"></div>
</div>
</div>
<span className="text-label-sm text-on-surface-variant">60%</span>
</div>
</div>
<button className="mt-lg w-full py-xs text-primary font-label-md text-label-md hover:underline decoration-2 underline-offset-4">عرض كل الوجهات</button>
</div>
</div>

<section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
<div className="p-md md:p-lg flex items-center justify-between border-b border-outline-variant">
<h2 className="font-title-lg text-title-lg text-on-surface">الحجوزات الأخيرة</h2>
<button className="px-md py-xs bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity">تصدير البيانات</button>
</div>
<div className="overflow-x-auto">
<table className="w-full text-right border-collapse">
<thead>
<tr className="bg-surface-container">
<th className="px-md py-sm font-label-md text-label-md text-on-surface-variant">رقم الحجز</th>
<th className="px-md py-sm font-label-md text-label-md text-on-surface-variant">العميل</th>
<th className="px-md py-sm font-label-md text-label-md text-on-surface-variant">الرحلة/الفندق</th>
<th className="px-md py-sm font-label-md text-label-md text-on-surface-variant">التاريخ</th>
<th className="px-md py-sm font-label-md text-label-md text-on-surface-variant">المبلغ</th>
<th className="px-md py-sm font-label-md text-label-md text-on-surface-variant">الحالة</th>
<th className="px-md py-sm"></th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant">
<tr className="hover:bg-surface transition-colors">
<td className="px-md py-md font-label-md text-label-md text-on-surface">#SAF-8902</td>
<td className="px-md py-md">
<div className="flex items-center gap-base">
<div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-[12px]">MS</div>
<span className="font-label-md text-label-md text-on-surface">محمد سالم</span>
</div>
</td>
<td className="px-md py-md font-body-md text-body-md text-on-surface-variant">رحلة: القاهرة - لندن</td>
<td className="px-md py-md font-body-md text-body-md text-on-surface-variant">24 مايو 2024</td>
<td className="px-md py-md font-label-md text-label-md text-on-surface">1,240 $</td>
<td className="px-md py-md">
<span className="px-base py-xs bg-tertiary-fixed text-on-tertiary-fixed rounded-full text-[12px] font-bold">مؤكد</span>
</td>
<td className="px-md py-md">
<button className="material-symbols-outlined text-outline hover:text-primary">more_vert</button>
</td>
</tr>
<tr className="hover:bg-surface transition-colors">
<td className="px-md py-md font-label-md text-label-md text-on-surface">#SAF-8903</td>
<td className="px-md py-md">
<div className="flex items-center gap-base">
<div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-[12px]">LA</div>
<span className="font-label-md text-label-md text-on-surface">ليلى أحمد</span>
</div>
</td>
<td className="px-md py-md font-body-md text-body-md text-on-surface-variant">فندق: برج العرب</td>
<td className="px-md py-md font-body-md text-body-md text-on-surface-variant">25 مايو 2024</td>
<td className="px-md py-md font-label-md text-label-md text-on-surface">3,500 $</td>
<td className="px-md py-md">
<span className="px-base py-xs bg-secondary-container text-on-secondary-container rounded-full text-[12px] font-bold">قيد الانتظار</span>
</td>
<td className="px-md py-md">
<button className="material-symbols-outlined text-outline hover:text-primary">more_vert</button>
</td>
</tr>
<tr className="hover:bg-surface transition-colors">
<td className="px-md py-md font-label-md text-label-md text-on-surface">#SAF-8904</td>
<td className="px-md py-md">
<div className="flex items-center gap-base">
<div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-[12px]">KA</div>
<span className="font-label-md text-label-md text-on-surface">خالد علي</span>
</div>
</td>
<td className="px-md py-md font-body-md text-body-md text-on-surface-variant">رحلة: جدة - باريس</td>
<td className="px-md py-md font-body-md text-body-md text-on-surface-variant">26 مايو 2024</td>
<td className="px-md py-md font-label-md text-label-md text-on-surface">890 $</td>
<td className="px-md py-md">
<span className="px-base py-xs bg-error-container text-on-error-container rounded-full text-[12px] font-bold">ملغي</span>
</td>
<td className="px-md py-md">
<button className="material-symbols-outlined text-outline hover:text-primary">more_vert</button>
</td>
</tr>
</tbody>
</table>
</div>
<div className="p-md flex items-center justify-between border-t border-outline-variant">
<span className="text-label-sm text-on-surface-variant">عرض 3 من أصل 1,280 حجز</span>
<div className="flex gap-base">
<button className="p-xs border border-outline-variant rounded-lg hover:bg-surface disabled:opacity-50">
<span className="material-symbols-outlined">chevron_right</span>
</button>
<button className="p-xs border border-outline-variant rounded-lg hover:bg-surface">
<span className="material-symbols-outlined">chevron_left</span>
</button>
</div>
</div>
</section>
</div>
</main>
</div>

<nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant flex justify-around py-xs z-50">
<Link className="flex flex-col items-center p-xs text-primary" href="/">
<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
<span className="text-[10px] font-label-sm">الرئيسية</span>
</Link>
<Link className="flex flex-col items-center p-xs text-on-surface-variant" href="/">
<span className="material-symbols-outlined">calendar_month</span>
<span className="text-[10px] font-label-sm">الحجوزات</span>
</Link>
<Link className="flex flex-col items-center p-xs text-on-surface-variant" href="/">
<span className="material-symbols-outlined">flight</span>
<span className="text-[10px] font-label-sm">الرحلات</span>
</Link>
<Link className="flex flex-col items-center p-xs text-on-surface-variant" href="/">
<span className="material-symbols-outlined">bar_chart</span>
<span className="text-[10px] font-label-sm">التقارير</span>
</Link>
</nav>
    </>
  );
}
