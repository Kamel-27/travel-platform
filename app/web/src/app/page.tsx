"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AirportInput from "@/components/AirportInput";
import DatePicker from "@/components/DatePicker";
import PaxCabinPicker, { type PaxCabinValue } from "@/components/PaxCabinPicker";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function HomepagePage() {
  const router = useRouter();
  const [flightOrigin, setFlightOrigin] = useState("RUH");
  const [flightDest, setFlightDest] = useState("DXB");
  const [tripType, setTripType] = useState<"one-way" | "round-trip">("round-trip");
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })();
  const weekLaterDate = (() => { const d = new Date(); d.setDate(d.getDate() + 8); return d.toISOString().split("T")[0]; })();
  const [flightDate, setFlightDate] = useState(tomorrowDate);
  const [flightReturnDate, setFlightReturnDate] = useState(weekLaterDate);
  const [pax, setPax] = useState<PaxCabinValue>({ adults: 1, children: 0, infants: 0, cabin: "economy" });
  const [directOnly, setDirectOnly] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleFlightSearch = () => {
    if (!flightOrigin || !flightDest) {
      setSearchError("اختر مطار المغادرة والوصول أولاً");
      return;
    }
    if (flightOrigin === flightDest) {
      setSearchError("لا يمكن أن تكون الوجهة هي نفسها مدينة المغادرة");
      return;
    }
    if (!flightDate) {
      setSearchError("اختر تاريخ الذهاب");
      return;
    }
    if (tripType === "round-trip" && !flightReturnDate) {
      setSearchError("اختر تاريخ العودة أو بدّل إلى ذهاب فقط");
      return;
    }
    setSearchError(null);
    const params = new URLSearchParams({
      origin: flightOrigin,
      destination: flightDest,
      date: flightDate,
      adults: String(pax.adults),
      cabin: pax.cabin,
    });
    if (pax.children > 0) params.set("children", String(pax.children));
    if (pax.infants > 0) params.set("infants", String(pax.infants));
    if (tripType === "round-trip" && flightReturnDate) params.set("return_date", flightReturnDate);
    if (directOnly) params.set("direct", "1");
    router.push(`/flights?${params}`);
  };

  return (
    <>
      <SiteHeader overlay />
      <main>
        {/* Hero */}
        <section className="relative min-h-[620px] flex items-center -mt-16 pt-16">
          <div className="absolute inset-0 z-0 overflow-hidden bg-gradient-to-b from-[#12263f] to-primary">
            <Image
              src="/images/hero/hero-1.jpg"
              alt="جناح طائرة يحلق فوق الغيوم عند الغروب"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            {/* Bottom-up scrim for text and card legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/35" />
          </div>

          <div className="relative z-20 w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-xl">
            <div className="max-w-2xl text-white mb-lg">
              <h1 className="font-display-lg text-display-lg mb-sm drop-shadow-lg">اكتشف العالم بلمسة واحدة</h1>
              <p className="font-body-lg text-body-lg opacity-90 drop-shadow-md">
                قارن أسعار مئات شركات الطيران واحجز تذكرتك في دقائق
              </p>
              <div className="flex flex-wrap gap-sm mt-md">
                <span className="flex items-center gap-xs bg-white/15 backdrop-blur-sm rounded-full px-sm py-1 font-label-sm text-label-sm">
                  <span className="material-symbols-outlined !text-[16px]">bolt</span>
                  تأكيد فوري
                </span>
                <span className="flex items-center gap-xs bg-white/15 backdrop-blur-sm rounded-full px-sm py-1 font-label-sm text-label-sm">
                  <span className="material-symbols-outlined !text-[16px]">lock</span>
                  دفع آمن ومشفر
                </span>
                <span className="flex items-center gap-xs bg-white/15 backdrop-blur-sm rounded-full px-sm py-1 font-label-sm text-label-sm">
                  <span className="material-symbols-outlined !text-[16px]">support_agent</span>
                  دعم على مدار الساعة
                </span>
              </div>
            </div>

            {/* Search card */}
            <div className="glass-effect rounded-2xl shadow-2xl w-full">
              {/* Header row */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary !text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>flight</span>
                  <span className="font-title-md text-title-md text-primary font-bold">ابحث عن رحلتك</span>
                </div>
                <div className="flex bg-surface-container rounded-full p-0.5 gap-0.5">
                  <button type="button" onClick={() => { setTripType("round-trip"); if (!flightReturnDate) setFlightReturnDate(weekLaterDate); }}
                    className={`px-5 py-2 rounded-full font-label-md text-label-md transition-all cursor-pointer ${tripType === "round-trip" ? "bg-surface-container-lowest text-primary font-bold shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>
                    ذهاب وعودة
                  </button>
                  <button type="button" onClick={() => { setTripType("one-way"); setFlightReturnDate(""); }}
                    className={`px-5 py-2 rounded-full font-label-md text-label-md transition-all cursor-pointer ${tripType === "one-way" ? "bg-surface-container-lowest text-primary font-bold shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>
                    ذهاب فقط
                  </button>
                </div>
              </div>

              {/* Fields row */}
              <div className="px-5 pb-3">
                <div className="flex flex-col md:flex-row items-stretch border border-outline-variant/50 rounded-xl">
                  {/* Origin + destination with swap on their shared border */}
                  <div className="relative flex flex-col md:flex-row flex-[2] min-w-0">
                    <div className="flex-1 min-w-0 flex items-center gap-3 px-5 py-4 border-b md:border-b-0 md:border-l border-outline-variant/30">
                      <span className="material-symbols-outlined text-primary !text-[24px] shrink-0">flight_takeoff</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-on-surface-variant/60 font-medium leading-none mb-1.5">من أين؟</div>
                        <AirportInput icon="" value={flightOrigin} onChange={(code) => { setFlightOrigin(code); setSearchError(null); }} placeholder="اختر مطار المغادرة" />
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label="تبديل المغادرة والوصول"
                      onClick={() => { const tmp = flightOrigin; setFlightOrigin(flightDest); setFlightDest(tmp); }}
                      className="absolute left-4 md:left-1/2 top-1/2 -translate-y-1/2 md:-translate-x-1/2 z-20 w-9 h-9 rounded-full border border-outline-variant bg-surface-container-lowest text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary active:rotate-180 transition-all duration-300 cursor-pointer shadow-sm rotate-90 md:rotate-0"
                    >
                      <span className="material-symbols-outlined !text-[18px]">swap_horiz</span>
                    </button>

                    <div className="flex-1 min-w-0 flex items-center gap-3 px-5 py-4 border-b md:border-b-0 md:border-l border-outline-variant/30">
                      <span className="material-symbols-outlined text-primary !text-[24px] shrink-0">flight_land</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-on-surface-variant/60 font-medium leading-none mb-1.5">إلى أين؟</div>
                        <AirportInput icon="" value={flightDest} onChange={(code) => { setFlightDest(code); setSearchError(null); }} placeholder="اختر مطار الوصول" />
                      </div>
                    </div>
                  </div>

                  {/* Dates (departure + return rendered by DatePicker) */}
                  <div className="flex-[1.3] min-w-0">
                    <DatePicker
                      departureDate={flightDate}
                      returnDate={flightReturnDate}
                      onDepartureChange={(v) => { setFlightDate(v); setSearchError(null); }}
                      onReturnChange={(v) => { setFlightReturnDate(v); setSearchError(null); }}
                      minDate={todayStr}
                      tripType={tripType}
                      onTripTypeChange={setTripType}
                    />
                  </div>
                </div>
                {searchError && (
                  <p className="flex items-center gap-xs text-error font-label-md text-label-md mt-2 px-1">
                    <span className="material-symbols-outlined !text-[18px]">error</span>
                    {searchError}
                  </p>
                )}
              </div>

              {/* Options row */}
              <div className="flex flex-wrap items-center justify-between px-6 pb-5 pt-1 gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <PaxCabinPicker value={pax} onChange={setPax} />
                  <button
                    type="button"
                    aria-pressed={directOnly}
                    onClick={() => setDirectOnly((d) => !d)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border font-label-md text-label-md transition-all cursor-pointer ${
                      directOnly
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-outline-variant/60 text-on-surface-variant hover:border-outline-variant hover:bg-surface-container/40"
                    }`}
                  >
                    <span className="material-symbols-outlined !text-[18px]">
                      {directOnly ? "check" : "trending_flat"}
                    </span>
                    مباشر فقط
                  </button>
                </div>
                <button onClick={handleFlightSearch}
                  className="bg-primary text-on-primary px-10 py-3 rounded-xl font-label-lg text-label-lg font-bold flex items-center gap-2 hover:shadow-lg transition-all active:scale-[0.97] cursor-pointer shadow-md">
                  <span className="material-symbols-outlined !text-[22px]">search</span>
                  بحث
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Why Safariyat */}
        <section id="features" className="bg-surface-container py-xl">
          <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="mb-lg text-center">
              <h2 className="font-headline-lg text-headline-lg text-primary">لماذا تختار سفريات؟</h2>
              <p className="text-on-surface-variant font-body-md text-body-md mt-xs">أدوات حجز متكاملة تجعل تجربة سفرك أسهل</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant text-center space-y-sm">
                <span className="material-symbols-outlined text-primary text-5xl">flight_takeoff</span>
                <h4 className="font-title-lg text-title-lg text-on-surface">أسعار لحظية</h4>
                <p className="text-on-surface-variant font-body-md text-body-md">أسعار محدثة مباشرة من شركات الطيران بدون رسوم مخفية أو وسطاء.</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant text-center space-y-sm">
                <span className="material-symbols-outlined text-primary text-5xl">verified_user</span>
                <h4 className="font-title-lg text-title-lg text-on-surface">دفع آمن ومشفر</h4>
                <p className="text-on-surface-variant font-body-md text-body-md">جميع عمليات الدفع تتم عبر بوابات معتمدة مع تأكيد فوري للحجز.</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant text-center space-y-sm">
                <span className="material-symbols-outlined text-primary text-5xl">support_agent</span>
                <h4 className="font-title-lg text-title-lg text-on-surface">دعم فني متواصل</h4>
                <p className="text-on-surface-variant font-body-md text-body-md">فريق دعم جاهز لمساعدتك في أي وقت مع سياسة إلغاء واسترداد واضحة.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <section className="py-xl px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="bg-primary-container rounded-2xl p-lg md:p-xl flex flex-col md:flex-row items-center justify-between gap-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-primary/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
            <div className="relative z-10 text-right md:w-1/2">
              <h2 className="font-headline-lg text-headline-lg text-on-primary-fixed-variant mb-base">ابقَ على اطلاع بأفضل العروض</h2>
              <p className="font-body-lg text-body-lg text-on-primary-container">اشترك في نشرتنا البريدية لتصلك أحدث الصفقات والخصومات الحصرية قبل أي شخص آخر.</p>
            </div>
            <div className="relative z-10 w-full md:w-[45%] md:max-w-md shrink-0">
              {subscribed ? (
                <div className="flex items-center gap-sm bg-surface-container-lowest rounded-lg px-md py-3">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="font-body-md text-body-md text-on-surface">تم تسجيل بريدك — ستصلك أفضل العروض قريباً.</span>
                </div>
              ) : (
                <form
                  className="flex flex-col sm:flex-row gap-base"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newsletterEmail.includes("@")) setSubscribed(true);
                  }}
                >
                  <input
                    className="flex-grow bg-surface-container-lowest border-none rounded-lg px-md py-3 focus:ring-2 focus:ring-primary font-body-md text-body-md"
                    placeholder="بريدك الإلكتروني"
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                  />
                  <button type="submit" className="bg-primary text-on-primary px-md py-3 rounded-lg font-bold hover:bg-surface-tint transition-all whitespace-nowrap cursor-pointer">اشترك الآن</button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* SEO copy + FAQ */}
        <section className="py-xl px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-base text-right">حجز تذاكر الطيران مع سفريات</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl text-right">
            سفريات (Safariyat) منصة سفر عربية تتيح لك حجز تذاكر الطيران أونلاين في دقائق. نقارن أسعار رحلات الطيران من مئات شركات الطيران حول العالم لنعرض عليك أفضل الخيارات، مع دفع إلكتروني آمن، تأكيد فوري للحجز، وتذكرة إلكترونية تصلك مباشرة. وإذا تغيرت خططك، نوفر سياسة إلغاء واسترداد واضحة ودعم عملاء على مدار الساعة.
          </p>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-md text-right">الأسئلة الشائعة</h3>
          <div className="space-y-base">
            <details className="bg-surface-container-lowest rounded-xl p-md group">
              <summary className="font-title-lg text-title-lg text-on-surface cursor-pointer list-none">كيف أحجز تذكرة طيران عبر سفريات؟</summary>
              <p className="font-body-md text-body-md text-on-surface-variant mt-sm">اختر مدينة المغادرة والوجهة وتاريخ السفر، ثم قارن الرحلات والأسعار المتاحة واختر الرحلة المناسبة. أدخل بيانات المسافرين وادفع بأمان، وستصلك التذكرة الإلكترونية وتأكيد الحجز فوراً على بريدك الإلكتروني.</p>
            </details>
            <details className="bg-surface-container-lowest rounded-xl p-md group">
              <summary className="font-title-lg text-title-lg text-on-surface cursor-pointer list-none">كيف أحصل على أرخص أسعار تذاكر الطيران؟</summary>
              <p className="font-body-md text-body-md text-on-surface-variant mt-sm">احجز مبكراً قبل موعد السفر، وقارن أسعار أيام مختلفة إن كانت مواعيدك مرنة، وتابع قسم العروض لدينا باستمرار. أسعارنا محدثة لحظياً من شركات الطيران مباشرة بدون رسوم مخفية.</p>
            </details>
            <details className="bg-surface-container-lowest rounded-xl p-md group">
              <summary className="font-title-lg text-title-lg text-on-surface cursor-pointer list-none">هل الدفع عبر الموقع آمن؟</summary>
              <p className="font-body-md text-body-md text-on-surface-variant mt-sm">نعم، تتم جميع عمليات الدفع عبر بوابة دفع معتمدة ومشفرة بالكامل، ولا يتم تأكيد أي حجز إلا بعد التحقق من نجاح عملية الدفع. لا نخزن بيانات بطاقتك على خوادمنا.</p>
            </details>
            <details className="bg-surface-container-lowest rounded-xl p-md group">
              <summary className="font-title-lg text-title-lg text-on-surface cursor-pointer list-none">هل يمكنني إلغاء حجزي واسترداد المبلغ؟</summary>
              <p className="font-body-md text-body-md text-on-surface-variant mt-sm">يعتمد ذلك على شروط التذكرة أو الفندق الذي اخترته، وتظهر لك شروط الإلغاء بوضوح قبل إتمام الحجز. في حال كان الإلغاء متاحاً، يمكنك تنفيذه من صفحة &laquo;رحلاتي&raquo; ويتم استرداد المبلغ تلقائياً بنفس طريقة الدفع.</p>
            </details>
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: [
                  {
                    "@type": "Question",
                    name: "كيف أحجز تذكرة طيران عبر سفريات؟",
                    acceptedAnswer: { "@type": "Answer", text: "اختر مدينة المغادرة والوجهة وتاريخ السفر، ثم قارن الرحلات والأسعار المتاحة واختر الرحلة المناسبة. أدخل بيانات المسافرين وادفع بأمان، وستصلك التذكرة الإلكترونية وتأكيد الحجز فوراً على بريدك الإلكتروني." },
                  },
                  {
                    "@type": "Question",
                    name: "كيف أحصل على أرخص أسعار تذاكر الطيران؟",
                    acceptedAnswer: { "@type": "Answer", text: "احجز مبكراً قبل موعد السفر، وقارن أسعار أيام مختلفة إن كانت مواعيدك مرنة، وتابع قسم العروض باستمرار. الأسعار محدثة لحظياً من شركات الطيران مباشرة بدون رسوم مخفية." },
                  },
                  {
                    "@type": "Question",
                    name: "هل الدفع عبر سفريات آمن؟",
                    acceptedAnswer: { "@type": "Answer", text: "نعم، تتم جميع عمليات الدفع عبر بوابة دفع معتمدة ومشفرة بالكامل، ولا يتم تأكيد أي حجز إلا بعد التحقق من نجاح عملية الدفع." },
                  },
                  {
                    "@type": "Question",
                    name: "هل يمكن إلغاء الحجز واسترداد المبلغ؟",
                    acceptedAnswer: { "@type": "Answer", text: "يعتمد ذلك على شروط التذكرة أو الفندق، وتظهر شروط الإلغاء بوضوح قبل إتمام الحجز. في حال كان الإلغاء متاحاً يتم استرداد المبلغ تلقائياً بنفس طريقة الدفع." },
                  },
                ],
              }),
            }}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
