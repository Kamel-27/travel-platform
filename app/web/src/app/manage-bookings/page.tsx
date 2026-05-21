"use client";

import Link from "next/link";


export default function ManageBookingsPage() {

  return (
    <>
      
<header className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm sticky top-0 z-50">
<div className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-16">
<div className="flex items-center gap-md">
<span className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary">سفريات</span>
<nav className="hidden md:flex gap-md mt-1">
<Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/">رحلات طيران</Link>
<Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/">فنادق</Link>
<Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/">عروض</Link>
<Link className="text-primary dark:text-inverse-primary font-bold border-b-2 border-primary dark:border-inverse-primary pb-1 font-label-md text-label-md" href="/">رحلاتي</Link>
</nav>
</div>
<div className="flex items-center gap-base">
<div className="hidden md:flex items-center gap-xs text-on-surface-variant">
<span className="material-symbols-outlined text-body-md" data-icon="language">language</span>
<span className="font-label-md text-label-md">AR / USD</span>
</div>
<button className="p-base hover:bg-surface-container rounded-full transition-colors relative">
<span className="material-symbols-outlined" data-icon="notifications">notifications</span>
<span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
</button>
<div className="flex items-center gap-sm pr-base border-r border-outline-variant mr-base">
<div className="text-left hidden md:block">
<p className="font-label-md text-label-md font-bold leading-none">أحمد المسؤول</p>
<p className="text-label-sm text-label-sm text-on-surface-variant">مدير النظام</p>
</div>
<img alt="صورة الملف الشخصي" className="w-10 h-10 rounded-full object-cover border-2 border-primary-container" data-alt="A professional headshot of a middle-aged Arab businessman in a modern office environment. He is wearing a crisp white shirt and a charcoal grey blazer. The background is a brightly lit, blurred minimalist corporate workspace with glass walls and soft blue accent colors. The lighting is flattering and high-key, conveying authority and reliability in a corporate modern style." src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7VmntjDodzuIgrnC-IhKbzO_ySxhV7plhLOWbjaJPYFuISe5aelWM4yefDp5pgvF1cIK-DtL7SZO1i0ig-cMsHCnrY2YW99BP6MXKumIIBDnRDZnkvj7YWu8et53yJBhCDZDigJejVln_dV3pzfH2vAN4lxk83Kt0v7J5gxobdGtLsBYaycK_frGMtR538pIvnWewztRK5gFs9ortFyi0qjvSNb_6H1yFPaOOkqqGA2FRjR25cjDCJywCE37Srt3z1OpIkjMrE7s1"/>
</div>
</div>
</div>
</header>
<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-lg">

<div className="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-md">
<div>
<h1 className="font-headline-lg text-headline-lg text-primary mb-xs">إدارة الحجوزات</h1>
<p className="font-body-md text-body-md text-on-surface-variant">مرحباً بك، لديك 24 حجزاً جديداً يتطلب المراجعة اليوم.</p>
</div>
<div className="flex gap-base">
<button className="bg-primary text-on-primary px-md py-sm rounded-lg flex items-center gap-xs font-label-md text-label-md hover:brightness-110 transition-all active:scale-95">
<span className="material-symbols-outlined" data-icon="add">add</span>
                    إضافة حجز يدوي
                </button>
<button className="bg-surface-container-highest text-on-surface px-md py-sm rounded-lg flex items-center gap-xs font-label-md text-label-md hover:bg-surface-variant transition-all">
<span className="material-symbols-outlined" data-icon="download">download</span>
                    تصدير التقارير
                </button>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-lg">
<div className="glass-card p-md rounded-xl shadow-sm border-r-4 border-r-primary">
<p className="text-on-surface-variant font-label-md text-label-md mb-xs">إجمالي الحجوزات</p>
<div className="flex items-center justify-between">
<h2 className="font-headline-md text-headline-md font-bold">1,284</h2>
<span className="text-primary bg-primary-fixed px-xs py-1 rounded text-label-sm font-label-sm">+12%</span>
</div>
</div>
<div className="glass-card p-md rounded-xl shadow-sm border-r-4 border-r-tertiary">
<p className="text-on-surface-variant font-label-md text-label-md mb-xs">إجمالي المبيعات</p>
<div className="flex items-center justify-between">
<h2 className="font-headline-md text-headline-md font-bold">$42,500</h2>
<span className="text-tertiary bg-tertiary-fixed px-xs py-1 rounded text-label-sm font-label-sm">+8.4%</span>
</div>
</div>
<div className="glass-card p-md rounded-xl shadow-sm border-r-4 border-r-secondary">
<p className="text-on-surface-variant font-label-md text-label-md mb-xs">نشط الآن</p>
<div className="flex items-center justify-between">
<h2 className="font-headline-md text-headline-md font-bold">142</h2>
<div className="flex -space-x-2 space-x-reverse overflow-hidden">
<div className="w-6 h-6 rounded-full bg-surface-dim border-2 border-white flex items-center justify-center text-[10px]">+5</div>
<img alt="user" className="w-6 h-6 rounded-full border-2 border-white" data-alt="Close up of a friendly professional person portrait for a profile thumbnail. Professional lighting, clean background, corporate style." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBR-br7sqFyNLibDBq81pYFyKiaPJNHO79-IGzbN0tMTWrbYliR722lU0h7Paux3F_ZJce7RODwHiD3oJNTsIfbtiVz2pU1Pg4TRy09i4gJB271MA6-X-4xf6CtVbNeUYuJUS6TWKBNIEbzbx1LWrVJkA-blBNZu_164p46ME99-xkxrQjdsa0meDmoa5FhXXRafl9FSeXnQz4N0iPQqFeBuM0QTIgACZCf5gDD34_ZhqPwXNI6Z2Fgbit1njq5Cl1OJL0Np3HvpDPU"/>
<img alt="user" className="w-6 h-6 rounded-full border-2 border-white" data-alt="Close up of a friendly professional person portrait for a profile thumbnail. Professional lighting, clean background, corporate style." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDm80ViQ75ycVMsIWi5sSvHspnJ-Djwhw_Ukx1gsQl5aSler19varfy19LKzNkPvsKjWeeDDb5esYNkwNGGw6u-0FLhUkE-0HwYF2XERlgggtBc35aO2AF5EG0YE3WDd4Wcx2lKu-bZyqF6I9ZuG_k4h1ITd1usKDSYa_qweQZtLoXv6umOidy-2Z_pTZYwWqSuVg1zcGv68b1IH5-ap34qTzPywFb-Q6_KJX7184QSGiY-QxIwywVyf-M-vUeBs2z-Z0SL7sXs3abV"/>
</div>
</div>
</div>
<div className="glass-card p-md rounded-xl shadow-sm border-r-4 border-r-error">
<p className="text-on-surface-variant font-label-md text-label-md mb-xs">طلبات الاسترجاع</p>
<div className="flex items-center justify-between">
<h2 className="font-headline-md text-headline-md font-bold">18</h2>
<span className="material-symbols-outlined text-error" data-icon="pending_actions">pending_actions</span>
</div>
</div>
</div>

<div className="glass-card p-md rounded-xl mb-md flex flex-col md:flex-row gap-md items-center">
<div className="w-full md:flex-1 relative">
<span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant" data-icon="search">search</span>
<input className="w-full bg-surface-container pr-12 pl-4 py-3 rounded-lg border-none focus:ring-2 focus:ring-primary font-body-md text-body-md transition-all" placeholder="البحث عن طريق رقم الحجز، اسم العميل، أو الوجهة..." type="text"/>
</div>
<div className="flex gap-base w-full md:w-auto">
<select className="bg-surface-container border-none rounded-lg px-md py-3 font-label-md text-label-md focus:ring-2 focus:ring-primary">
<option>نوع الخدمة (الكل)</option>
<option>طيران</option>
<option>فندق</option>
</select>
<select className="bg-surface-container border-none rounded-lg px-md py-3 font-label-md text-label-md focus:ring-2 focus:ring-primary">
<option>الحالة (الكل)</option>
<option>مؤكد</option>
<option>قيد الانتظار</option>
<option>تم الإلغاء</option>
</select>
<button className="p-3 bg-surface-container rounded-lg hover:bg-surface-variant transition-colors">
<span className="material-symbols-outlined" data-icon="filter_list">filter_list</span>
</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant">
<div className="overflow-x-auto scrollbar-hide">
<table className="w-full text-right border-collapse">
<thead>
<tr className="bg-surface-container text-on-surface-variant">
<th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">رقم الحجز</th>
<th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">العميل</th>
<th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">نوع الخدمة</th>
<th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">تاريخ الحجز</th>
<th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">المبلغ</th>
<th className="px-md py-md font-label-md text-label-md border-b border-outline-variant">الحالة</th>
<th className="px-md py-md font-label-md text-label-md border-b border-outline-variant text-center">الإجراءات</th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant">

<tr className="hover:bg-surface-container-low transition-colors group">
<td className="px-md py-md font-label-md text-label-md font-bold text-primary">#SF-9042</td>
<td className="px-md py-md">
<div className="flex items-center gap-sm">
<div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center font-bold text-secondary text-xs">س</div>
<div>
<p className="font-label-md text-label-md">سارة العتيبي</p>
<p className="text-label-sm text-label-sm text-on-surface-variant">sara.a@example.com</p>
</div>
</div>
</td>
<td className="px-md py-md">
<div className="flex items-center gap-xs">
<span className="material-symbols-outlined text-primary" data-icon="flight">flight</span>
<span className="font-body-md text-body-md">طيران (دبي - لندن)</span>
</div>
</td>
<td className="px-md py-md font-body-md text-body-md">15 أكتوبر 2024</td>
<td className="px-md py-md font-label-md text-label-md font-bold">$1,240</td>
<td className="px-md py-md">
<span className="bg-green-100 text-green-800 px-sm py-1 rounded-full text-label-sm font-label-sm">مؤكد</span>
</td>
<td className="px-md py-md">
<div className="flex justify-center gap-base">
<button className="p-xs hover:text-primary transition-colors" title="التفاصيل"><span className="material-symbols-outlined" data-icon="visibility">visibility</span></button>
<button className="p-xs hover:text-secondary transition-colors" title="تعديل"><span className="material-symbols-outlined" data-icon="edit">edit</span></button>
<button className="p-xs hover:text-error transition-colors" title="استرجاع"><span className="material-symbols-outlined" data-icon="keyboard_return">keyboard_return</span></button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors group">
<td className="px-md py-md font-label-md text-label-md font-bold text-primary">#SF-8821</td>
<td className="px-md py-md">
<div className="flex items-center gap-sm">
<div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-primary text-xs">م</div>
<div>
<p className="font-label-md text-label-md">محمد القحطاني</p>
<p className="text-label-sm text-label-sm text-on-surface-variant">m.qahtani@example.com</p>
</div>
</div>
</td>
<td className="px-md py-md">
<div className="flex items-center gap-xs">
<span className="material-symbols-outlined text-tertiary" data-icon="hotel">hotel</span>
<span className="font-body-md text-body-md">فندق (الرياض ريتز)</span>
</div>
</td>
<td className="px-md py-md font-body-md text-body-md">14 أكتوبر 2024</td>
<td className="px-md py-md font-label-md text-label-md font-bold">$850</td>
<td className="px-md py-md">
<span className="bg-yellow-100 text-yellow-800 px-sm py-1 rounded-full text-label-sm font-label-sm">قيد الانتظار</span>
</td>
<td className="px-md py-md">
<div className="flex justify-center gap-base">
<button className="p-xs hover:text-primary transition-colors" title="التفاصيل"><span className="material-symbols-outlined" data-icon="visibility">visibility</span></button>
<button className="p-xs hover:text-secondary transition-colors" title="تعديل"><span className="material-symbols-outlined" data-icon="edit">edit</span></button>
<button className="p-xs hover:text-error transition-colors" title="استرجاع"><span className="material-symbols-outlined" data-icon="keyboard_return">keyboard_return</span></button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors group">
<td className="px-md py-md font-label-md text-label-md font-bold text-primary">#SF-8704</td>
<td className="px-md py-md">
<div className="flex items-center gap-sm">
<div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center font-bold text-secondary text-xs">ف</div>
<div>
<p className="font-label-md text-label-md">فيصل الشمري</p>
<p className="text-label-sm text-label-sm text-on-surface-variant">f.shamari@example.com</p>
</div>
</div>
</td>
<td className="px-md py-md">
<div className="flex items-center gap-xs">
<span className="material-symbols-outlined text-primary" data-icon="flight">flight</span>
<span className="font-body-md text-body-md">طيران (جدة - القاهرة)</span>
</div>
</td>
<td className="px-md py-md font-body-md text-body-md">12 أكتوبر 2024</td>
<td className="px-md py-md font-label-md text-label-md font-bold">$420</td>
<td className="px-md py-md">
<span className="bg-error-container text-error px-sm py-1 rounded-full text-label-sm font-label-sm">تم الإلغاء</span>
</td>
<td className="px-md py-md">
<div className="flex justify-center gap-base">
<button className="p-xs hover:text-primary transition-colors" title="التفاصيل"><span className="material-symbols-outlined" data-icon="visibility">visibility</span></button>
<button className="p-xs hover:text-secondary transition-colors" title="تعديل"><span className="material-symbols-outlined" data-icon="edit">edit</span></button>
<button className="p-xs hover:text-error transition-colors" title="استرجاع"><span className="material-symbols-outlined" data-icon="keyboard_return">keyboard_return</span></button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors group">
<td className="px-md py-md font-label-md text-label-md font-bold text-primary">#SF-8699</td>
<td className="px-md py-md">
<div className="flex items-center gap-sm">
<div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-primary text-xs">ل</div>
<div>
<p className="font-label-md text-label-md">ليلى محمود</p>
<p className="text-label-sm text-label-sm text-on-surface-variant">laila.m@example.com</p>
</div>
</div>
</td>
<td className="px-md py-md">
<div className="flex items-center gap-xs">
<span className="material-symbols-outlined text-tertiary" data-icon="hotel">hotel</span>
<span className="font-body-md text-body-md">فندق (هيلتون كاش)</span>
</div>
</td>
<td className="px-md py-md font-body-md text-body-md">10 أكتوبر 2024</td>
<td className="px-md py-md font-label-md text-label-md font-bold">$1,560</td>
<td className="px-md py-md">
<span className="bg-green-100 text-green-800 px-sm py-1 rounded-full text-label-sm font-label-sm">مؤكد</span>
</td>
<td className="px-md py-md">
<div className="flex justify-center gap-base">
<button className="p-xs hover:text-primary transition-colors" title="التفاصيل"><span className="material-symbols-outlined" data-icon="visibility">visibility</span></button>
<button className="p-xs hover:text-secondary transition-colors" title="تعديل"><span className="material-symbols-outlined" data-icon="edit">edit</span></button>
<button className="p-xs hover:text-error transition-colors" title="استرجاع"><span className="material-symbols-outlined" data-icon="keyboard_return">keyboard_return</span></button>
</div>
</td>
</tr>
</tbody>
</table>
</div>

<div className="bg-surface-container p-md flex items-center justify-between">
<span className="text-label-sm text-label-sm text-on-surface-variant">عرض 1-4 من أصل 1,284 حجز</span>
<div className="flex gap-xs">
<button className="w-8 h-8 rounded border border-outline-variant flex items-center justify-center hover:bg-surface-container-highest transition-colors">
<span className="material-symbols-outlined text-body-md" data-icon="chevron_right">chevron_right</span>
</button>
<button className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-bold text-label-sm">1</button>
<button className="w-8 h-8 rounded border border-outline-variant flex items-center justify-center hover:bg-surface-container-highest transition-colors font-bold text-label-sm">2</button>
<button className="w-8 h-8 rounded border border-outline-variant flex items-center justify-center hover:bg-surface-container-highest transition-colors font-bold text-label-sm">3</button>
<button className="w-8 h-8 rounded border border-outline-variant flex items-center justify-center hover:bg-surface-container-highest transition-colors">
<span className="material-symbols-outlined text-body-md" data-icon="chevron_left">chevron_left</span>
</button>
</div>
</div>
</div>
</main>

<footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant">
<div className="w-full py-lg px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
<div className="flex flex-col md:items-start items-center gap-xs">
<span className="font-headline-md text-headline-md font-extrabold text-primary dark:text-primary-fixed-dim">سفريات</span>
<p className="text-on-surface-variant dark:text-on-secondary-container font-label-sm text-label-sm">© 2024 سفريات. جميع الحقوق محفوظة.</p>
</div>
<nav className="flex gap-md">
<Link className="text-on-surface-variant dark:text-on-secondary-container font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">عن سفريات</Link>
<Link className="text-on-surface-variant dark:text-on-secondary-container font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">سياسة الخصوصية</Link>
<Link className="text-on-surface-variant dark:text-on-secondary-container font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">الشروط والأحكام</Link>
<Link className="text-on-surface-variant dark:text-on-secondary-container font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity opacity-80 hover:opacity-100" href="/">اتصل بنا</Link>
</nav>
</div>
</footer>

<div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant h-16 flex justify-around items-center px-md z-50">
<button className="flex flex-col items-center gap-1 text-on-surface-variant">
<span className="material-symbols-outlined" data-icon="home">home</span>
<span className="text-[10px] font-label-sm">الرئيسية</span>
</button>
<button className="flex flex-col items-center gap-1 text-primary">
<span className="material-symbols-outlined" data-icon="airplane_ticket">airplane_ticket</span>
<span className="text-[10px] font-label-sm">الحجوزات</span>
</button>
<button className="flex flex-col items-center gap-1 text-on-surface-variant">
<span className="material-symbols-outlined" data-icon="insights">insights</span>
<span className="text-[10px] font-label-sm">التقارير</span>
</button>
<button className="flex flex-col items-center gap-1 text-on-surface-variant">
<span className="material-symbols-outlined" data-icon="settings">settings</span>
<span className="text-[10px] font-label-sm">الإعدادات</span>
</button>
</div>
    </>
  );
}
