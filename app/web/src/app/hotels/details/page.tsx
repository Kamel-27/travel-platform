"use client";

import { useState } from "react";
import Link from "next/link";

export default function HotelDetailsPage() {
  const [roomType, setRoomType] = useState("deluxe");
  const [nights, setNights] = useState(2);
  const [guests, setGuests] = useState("2 بالغين، 0 أطفال");

  const pricePerNight = roomType === "deluxe" ? 2450 : roomType === "executive" ? 3800 : 6200;
  const basePrice = pricePerNight * nights;
  const vat = Math.round(basePrice * 0.15);
  const totalPrice = basePrice + vat;

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans" dir="rtl">
      {/* TopNavBar */}
      <nav className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm fixed top-0 w-full z-50 border-b border-outline-variant">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto h-16">
          <div className="flex items-center gap-lg">
            <Link href="/" className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary">
              سفريات
            </Link>
            <div className="hidden md:flex gap-md">
              <Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/flights">
                رحلات طيران
              </Link>
              <Link className="text-primary dark:text-inverse-primary font-bold border-b-2 border-primary pb-1 font-label-md text-label-md" href="/hotels">
                فنادق
              </Link>
              <Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/support">
                الدعم والمساعدة
              </Link>
              <Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="/manage-bookings">
                رحلاتي
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-md">
            <div className="flex items-center gap-xs text-on-surface-variant">
              <span className="material-symbols-outlined hover:text-primary cursor-pointer">language</span>
              <span className="material-symbols-outlined hover:text-primary cursor-pointer">currency_exchange</span>
              <span className="material-symbols-outlined hover:text-primary cursor-pointer">notifications</span>
            </div>
            <Link href="/signin" className="bg-primary text-on-primary px-md py-xs rounded-lg font-label-md text-label-md scale-98 active:scale-95 transition-transform">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </nav>

      <main className="mt-16 pt-lg max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
        {/* Bento Gallery Section */}
        <section className="relative mb-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-sm rounded-xl overflow-hidden">
            <div className="md:col-span-2 md:row-span-2 relative group cursor-pointer overflow-hidden h-[300px] md:h-[412px]">
              <img 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9dhp7y8xdpkqi3oMU_LNvgIGN5v4kKlmZ4qYDqcE4KcUQLT8zfTiyRm1YIgGbNNHQKhgir_z_s19eWdIjYmRUY2oEjRrBdzinu7RiuOeAkwBxf2Xg4MqJfavvjuGWTb57Bh4zSx2ZASSusGmFniRcOsc6OiTFf65q51lyf6SzIJ-HJYLzm724cwPtuJ-UGsc6C7xob9WGZv0jgsP-W6906kG8_SnkUSmqqUEwY4wxEs8FjFhkVH0BX9yq6iPUQnT9M1Oh6PZwgkdW"
                alt="Ritz-Carlton Riyadh"
              />
            </div>
            <div className="relative group cursor-pointer overflow-hidden h-[100px] md:h-[200px]">
              <img 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgqIGUdxLpEU5_-LnAV4FEdhIQR7G0RiaJGhDpPzt_qMWgYomFKVAKm7l5SQ5BZYMp5EAOAVrLnjhShkY4hNx4EBEaqYDJ6QXf-1qDHSSxkEy2jGGlsR4cT-QS2dIilqsEhH3AfeJn14h2n6qeGSsF6VuuDTlYIqHyBAbz8GzjvK7UacIw-iWsg6birZwV6Mu-T5Id2TjW8G00ErhjwHf_bzhBzqjkBUB6NP1-H-RH_qJAhEbh9dZaRNlNNYLVf8CSgAEmEQjOdyHa"
                alt="Indoor pool"
              />
            </div>
            <div className="relative group cursor-pointer overflow-hidden h-[100px] md:h-[200px]">
              <img 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDORnu4D625xEPQL0vbnSdc__HY5peaBxQFgXskEPp6DdqSkPN2BDHa8fH5bpk0x2GmqJKqFthf5RF4CjtUZ7NmKL-FaqTqThXoG9Z05gkGhYlwyYohPkPdTeyuFiR1NrQ6X5MIkWsFQN8Tzm10duG11gp-BORHrVVgBfR_zz9WTyPLM3uhSJ7WNyPfwQtreoyjqHMDQj2rz8-mDSFVDukF-C-JmPdhs6W5TqyFzwVYLDo9aSODE-AhfL-N2ebQ1eJiCLsxsDLWFW97"
                alt="Luxury suite"
              />
            </div>
            <div className="relative group cursor-pointer overflow-hidden h-[100px] md:h-[200px]">
              <img 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAw4fKZVcFiejgqN7NgBYalz4iIqpF83ixSAor95J22tkYqcG9QHky69geh-uJNUg0A3hPN6ZbfW9zNXROAfrWP_8aNDRTxBwiRfQB_jgbtCfAjQSNqnIFGBv196pk_ylsXfTU_a0Fv8Eic_GzvBv-30YabBCH_WZeODLKZtKbCcTne4HzY9j2m0kLmZh3HfJPrVhd-P17cup5v2yfmYbNhtRKLitrdEWf6gPoaT7fgKF95X5scpfXXHK8WQ8BXz55CCaZEMRzzYvmM"
                alt="Spa treatment"
              />
            </div>
            <div className="relative group cursor-pointer overflow-hidden h-[100px] md:h-[200px]">
              <img 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDF7uK8WeYtZLqGsX7js09c1C3jtKzRHzuwQqopapiHBtI7exjYV_eTdq_GPdrXjFiG90Ffl8Du38Gqo7kv-w_NOVw7gVasmNOT8xurMyhthriagoPZHuDjds0NkN306L9aNQJgNxAotVT_XIFDUdRxpZWm46HpuOU9RxWzsoSXtlnWXkmVFwzObrFSA66hlioRuFb65qzf2FTw2oUcJnofSJkpwkHemCCxyn2-OD1tpsaMy1rRcIJCiybrm2u0EkHoGZd_-kRha7yS"
                alt="Lobby restaurant"
              />
            </div>
          </div>
          <button className="absolute bottom-md left-md bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant px-md py-sm rounded-lg font-label-md text-label-md flex items-center gap-xs shadow-lg hover:bg-surface-container-low transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-primary">grid_view</span>
            <span>عرض كل الصور (+24)</span>
          </button>
        </section>

        {/* Header Info */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-lg gap-base">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-xs">فندق ريتز كارلتون الرياض</h1>
            <div className="flex items-center gap-sm flex-wrap">
              <div className="flex text-tertiary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              </div>
              <div className="flex items-center gap-xs text-on-surface-variant font-body-md text-body-md">
                <span className="material-symbols-outlined text-primary">location_on</span>
                <span>طريق الهدا، منطقة الهدا، الرياض، المملكة العربية السعودية</span>
              </div>
            </div>
          </div>
          <div className="flex gap-sm">
            <button className="border border-outline px-md py-sm rounded-lg font-label-md text-label-md flex items-center gap-xs hover:bg-surface-container transition-colors cursor-pointer">
              <span className="material-symbols-outlined">share</span>
              <span>مشاركة</span>
            </button>
            <button className="border border-outline px-md py-sm rounded-lg font-label-md text-label-md flex items-center gap-xs hover:bg-surface-container transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
              <span>حفظ المفضلة</span>
            </button>
          </div>
        </header>

        {/* Tabs Navigation */}
        <nav className="border-b border-outline-variant mb-lg overflow-x-auto">
          <div className="flex gap-lg min-w-max">
            <button className="pb-base font-bold text-primary border-b-2 border-primary font-title-lg text-title-lg cursor-pointer">نظرة عامة</button>
            <button className="pb-base text-secondary font-label-md text-label-md hover:text-primary transition-colors cursor-pointer">الغرف المتوفرة</button>
            <button className="pb-base text-secondary font-label-md text-label-md hover:text-primary transition-colors cursor-pointer">المرافق والخدمات</button>
            <button className="pb-base text-secondary font-label-md text-label-md hover:text-primary transition-colors cursor-pointer">تقييمات النزلاء</button>
          </div>
        </nav>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-xl mb-xl">
          {/* Left Column */}
          <div className="space-y-xl">
            {/* Overview */}
            <section>
              <h2 className="font-headline-md text-headline-md text-primary font-bold mb-md">عن الفندق</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed text-justify">
                يعد فندق ريتز كارلتون الرياض وجهة بارزة للفخامة والرفاهية في قلب العاصمة السعودية. يمتد الفندق على مساحة 52 فدانًا من الحدائق الغناء والأشجار المنسقة، ويتميز بتصميمه المعماري المستوحى من القصور العربية الكلاسيكية مع لمسات عصرية فاخرة وأسقف مذهبة عالية. يقدم الفندق تجربة إقامة استثنائية تجمع بين الضيافة العربية الأصيلة ومعايير الخدمة العالمية الرفيعة، مما يجعله الخيار الأول للمسافرين الباحثين عن التميز والخصوصية التامة في مدينة الرياض.
              </p>
            </section>

            {/* Facilities Grid */}
            <section>
              <h2 className="font-headline-md text-headline-md text-primary font-bold mb-md">المرافق والخدمات البارزة</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
                <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary shrink-0">spa</span>
                  <span className="font-label-md text-label-md text-on-surface">سبا ونادي صحي</span>
                </div>
                <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary shrink-0">fitness_center</span>
                  <span className="font-label-md text-label-md text-on-surface">صالة لياقة بدنية</span>
                </div>
                <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary shrink-0">pool</span>
                  <span className="font-label-md text-label-md text-on-surface">مسبح داخلي دافئ</span>
                </div>
                <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary shrink-0">local_parking</span>
                  <span className="font-label-md text-label-md text-on-surface">مواقف سيارات مجانية</span>
                </div>
                <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary shrink-0">wifi</span>
                  <span className="font-label-md text-label-md text-on-surface">إنترنت لاسلكي سريع</span>
                </div>
                <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary shrink-0">restaurant</span>
                  <span className="font-label-md text-label-md text-on-surface">6 مطاعم عالمية</span>
                </div>
                <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary shrink-0">business_center</span>
                  <span className="font-label-md text-label-md text-on-surface">مركز رجال أعمال</span>
                </div>
                <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary shrink-0">room_service</span>
                  <span className="font-label-md text-label-md text-on-surface">خدمة غرف 24 ساعة</span>
                </div>
              </div>
              <button className="mt-md text-primary font-label-md text-label-md flex items-center gap-xs hover:underline cursor-pointer">
                عرض جميع المرافق والخدمات الـ 20+
                <span className="material-symbols-outlined text-sm font-bold">arrow_left</span>
              </button>
            </section>

            {/* Map Section */}
            <section>
              <h2 className="font-headline-md text-headline-md text-primary font-bold mb-md">الموقع الجغرافي</h2>
              <div className="rounded-xl overflow-hidden h-[300px] border border-outline-variant relative">
                <img 
                  className="w-full h-full object-cover" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAA_Wq_bp5B7l10M-gSAY-Yp7oZSHiidlnl_TGiaePFXNRFc4PVHOl88RJGCynOuzQGpeRmE9ep7J2A-hxKBtzeWwbmewnM_R90tPcqxcrukKkhsdACMvUVri-GYTbIwS3vdDBPM5mtFWL0Akjv6B-O3HimwqjQHivlbn1BY-a_StiSA5jZY1QzHOKJLaj5Km5wipHw27uraUe1rNnSP0ZhfxllsyrbChvu7Tsg5_QUX___xXPWf1p_S48HUx_yqlGMiBi1vPicmj_A"
                  alt="Riyadh Map"
                />
                <div className="absolute top-md right-md bg-white p-md rounded-xl shadow-lg max-w-[220px] border border-outline-variant">
                  <h4 className="font-label-md text-label-md font-bold mb-xs text-primary">المسافات القريبة</h4>
                  <ul className="text-label-sm space-y-sm text-on-surface-variant">
                    <li className="flex justify-between items-center">
                      <span>مركز الملك عبدالله</span> 
                      <span className="font-bold text-on-surface">15 دقيقة بالسيارة</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span>مطار الملك خالد الدولي</span> 
                      <span className="font-bold text-on-surface">35 دقيقة بالسيارة</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Reviews Section */}
            <section>
              <div className="flex items-center justify-between mb-md flex-wrap gap-sm">
                <h2 className="font-headline-md text-headline-md text-primary font-bold">تقييمات النزلاء والمقيمين</h2>
                <div className="flex items-center gap-sm">
                  <span className="font-display-lg text-display-lg text-primary font-bold">4.9</span>
                  <div className="flex flex-col">
                    <span className="font-title-lg text-title-lg font-bold text-on-surface">ممتاز جداً</span>
                    <span className="font-label-sm text-label-sm text-secondary">بناءً على 1,240 تقييم موثق</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-md overflow-x-auto pb-md no-scrollbar">
                <div className="min-w-[280px] md:min-w-[340px] p-md bg-white border border-outline-variant rounded-xl shadow-sm flex flex-col justify-between">
                  <p className="font-body-md text-body-md italic text-on-surface-variant">
                    "إقامة مذهلة وفاخرة لأبعد الحدود، الخدمة هنا في قمة الرقي والاهتمام بالتفاصيل متناهي. بوفيه الطعام متنوع ولذيذ جداً وسأكرر الزيارة بالتأكيد."
                  </p>
                  <div className="flex items-center gap-sm mt-md pt-sm border-t border-outline-variant/30">
                    <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary font-bold text-base">A</div>
                    <div>
                      <h4 className="font-label-md text-label-md font-bold text-on-surface">أحمد المطيري</h4>
                      <span className="text-label-sm text-outline">منذ يومين</span>
                    </div>
                  </div>
                </div>

                <div className="min-w-[280px] md:min-w-[340px] p-md bg-white border border-outline-variant rounded-xl shadow-sm flex flex-col justify-between">
                  <p className="font-body-md text-body-md italic text-on-surface-variant">
                    "أفضل فندق في الرياض بلا منازع لتجربة الضيافة والرفاهية العالية. الهدوء والخصوصية والمرافق الصحية كانت تجربة متكاملة ورائعة للغاية."
                  </p>
                  <div className="flex items-center gap-sm mt-md pt-sm border-t border-outline-variant/30">
                    <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary font-bold text-base">L</div>
                    <div>
                      <h4 className="font-label-md text-label-md font-bold text-on-surface">لينا صالح</h4>
                      <span className="text-label-sm text-outline">منذ أسبوع</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column (Sticky Booking Card) */}
          <aside>
            <div className="bg-white border border-outline-variant rounded-xl p-md shadow-xl lg:sticky lg:top-24">
              <div className="flex justify-between items-center mb-md pb-xs border-b border-outline-variant/50">
                <div>
                  <span className="font-label-sm text-label-sm text-outline block">يبدأ السعر من</span>
                  <div className="flex items-baseline gap-xs">
                    <span className="font-headline-md text-headline-md text-primary font-bold">{pricePerNight.toLocaleString()}</span>
                    <span className="font-label-sm text-label-sm text-outline font-bold">ريال / ليلة</span>
                  </div>
                </div>
                <div className="bg-tertiary-fixed text-on-tertiary-fixed px-sm py-xs rounded-full font-label-sm text-label-sm font-bold shrink-0">
                  خصم 15% اليوم
                </div>
              </div>
              <div className="space-y-md">
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md block font-bold text-on-surface">تواريخ الإقامة</label>
                  <div className="grid grid-cols-2 gap-base border border-outline-variant rounded-lg p-sm cursor-pointer hover:border-primary transition-colors bg-surface-container-lowest">
                    <div className="border-l border-outline-variant px-xs">
                      <span className="font-label-sm text-label-sm text-outline block">تسجيل الوصول</span>
                      <span className="font-label-md text-label-md font-medium text-on-surface">24 مايو 2026</span>
                    </div>
                    <div className="px-xs">
                      <span className="font-label-sm text-label-sm text-outline block">تسجيل المغادرة</span>
                      <span className="font-label-md text-label-md font-medium text-on-surface">26 مايو 2026</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md block font-bold text-on-surface">الضيوف والغرف</label>
                  <div className="border border-outline-variant rounded-lg p-md flex justify-between items-center cursor-pointer hover:border-primary transition-colors bg-surface-container-lowest">
                    <span className="font-label-md text-label-md text-on-surface">{guests}</span>
                    <span className="material-symbols-outlined text-outline">expand_more</span>
                  </div>
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md block font-bold text-on-surface">نوع الغرفة المفضلة</label>
                  <select 
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full bg-white border border-outline-variant rounded-lg p-md font-label-md text-label-md focus:ring-primary focus:border-primary outline-none cursor-pointer"
                  >
                    <option value="deluxe">جناح ديلوكس كينج (سرير واحد كبير)</option>
                    <option value="executive">جناح تنفيذي بريميوم (إطلالة بانورامية)</option>
                    <option value="royal">الجناح الملكي الرئاسي (مساحة شاسعة)</option>
                  </select>
                </div>

                <div className="pt-md border-t border-outline-variant space-y-sm">
                  <div className="flex justify-between text-body-md text-on-surface-variant">
                    <span>{pricePerNight.toLocaleString()} ريال × {nights} ليلة</span>
                    <span className="font-medium text-on-surface">{basePrice.toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between text-body-md text-tertiary">
                    <span>ضريبة القيمة المضافة والرسوم المشمولة</span>
                    <span className="font-medium">{vat.toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between font-bold text-title-lg pt-sm border-t border-dashed border-outline-variant">
                    <span className="text-on-surface">المبلغ الإجمالي</span>
                    <span className="text-primary font-bold">{totalPrice.toLocaleString()} ريال</span>
                  </div>
                </div>

                <Link 
                  href="/checkout" 
                  className="w-full bg-primary hover:bg-primary-container text-white py-md rounded-lg font-title-lg text-title-lg font-bold shadow-md transform active:scale-95 transition-all text-center flex items-center justify-center cursor-pointer"
                >
                  احجز الآن بأفضل سعر
                </Link>
              </div>
              <p className="text-center font-label-sm text-label-sm text-outline mt-md flex items-center justify-center gap-xs">
                <span className="material-symbols-outlined text-sm text-tertiary">lock</span>
                سداد آمن ومحمي بنسبة 100%
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant mt-xl">
        <div className="w-full py-lg px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <div className="flex flex-col items-center md:items-start gap-xs">
            <span className="font-headline-md text-headline-md font-extrabold text-primary">سفريات</span>
            <p className="text-on-surface-variant font-label-sm text-label-sm">© 2026 سفريات. جميع الحقوق محفوظة.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-md">
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="#">عن سفريات</Link>
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="#">سياسة الخصوصية</Link>
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="#">الشروط والأحكام</Link>
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="#">اتصل بنا</Link>
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="#">الأسئلة الشائعة</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
