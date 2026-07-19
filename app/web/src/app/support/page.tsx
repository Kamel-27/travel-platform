"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api-client";
import { formatSystemTimestamp } from "@/lib/datetime";
import type { SupportTicket, SupportTicketType } from "@/lib/types";

const TYPE_OPTIONS: { value: SupportTicketType; label: string }[] = [
  { value: "cancellation", label: "إلغاء حجز" },
  { value: "flight_delay", label: "تأخير رحلة" },
  { value: "name_change", label: "تعديل اسم المسافر" },
  { value: "refund", label: "استرداد مبلغ" },
  { value: "other", label: "أخرى" },
];

const TYPE_LABELS = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

const STATUS_BADGES: Record<SupportTicket["status"], { label: string; classes: string }> = {
  open: { label: "مفتوحة", classes: "bg-orange-500/10 border-orange-500/30 text-orange-600" },
  in_progress: { label: "قيد المعالجة", classes: "bg-primary/10 border-primary/30 text-primary" },
  resolved: { label: "تم الحل", classes: "bg-green-500/10 border-green-500/30 text-green-600" },
};

export default function HelpSupportPage() {
  const { isAuthenticated, isLoading } = useAuth();

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Form State
  const [issueType, setIssueType] = useState<SupportTicketType>("cancellation");
  const [bookingRef, setBookingRef] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // My tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const res = await api.get<{ data: SupportTicket[] }>("/support/tickets");
      setTickets(res.data);
    } catch {
      // Non-fatal: the page still works without the history list.
    } finally {
      setTicketsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void (async () => {
      await loadTickets();
    })();
  }, [isAuthenticated, loadTickets]);

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      await api.post<SupportTicket>("/support/tickets", {
        type: issueType,
        booking_reference: bookingRef.trim() || undefined,
        description: description.trim(),
      });
      setSubmitSuccess(true);
      setBookingRef("");
      setDescription("");
      void loadTickets();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.message || "فشل إرسال التذكرة، حاول مرة أخرى.");
      } else {
        setSubmitError("حدث خطأ غير متوقع أثناء إرسال التذكرة.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "كيف يمكنني إلغاء حجزي واسترجاع المبلغ؟",
      a: "من صفحة «رحلاتي» اختر الحجز ثم «إلغاء الحجز». تظهر لك رسوم الإلغاء والمبلغ المسترد قبل التأكيد، وبعض الحجوزات تتطلب مراجعة يدوية من فريق الدعم خلال 24 ساعة. يُرد المبلغ تلقائياً بنفس طريقة الدفع.",
    },
    {
      q: "كيف أحصل على تذكرتي الإلكترونية؟",
      a: "بعد تأكيد الحجز يمكنك تحميل التذكرة الإلكترونية (PDF) من صفحة تفاصيل الحجز في «رحلاتي»، وتتضمن أرقام التذاكر الصادرة من شركة الطيران لكل مسافر.",
    },
    {
      q: "طريقة تعديل اسم المسافر",
      a: "تعديل الأسماء يخضع لشروط صارمة من قبل شركات الطيران. افتح تذكرة دعم من نوع «تعديل اسم المسافر» مع رقم الحجز وسيتواصل معك الفريق بالخيارات المتاحة وأي رسوم تفرضها الناقلة.",
    },
    {
      q: "ما هي خيارات الدفع المتاحة؟",
      a: "الدفع الإلكتروني بالبطاقات البنكية (فيزا وماستركارد) عبر بوابة دفع آمنة ومشفرة. لا يتم تأكيد أي حجز إلا بعد نجاح عملية الدفع، ولا نخزن بيانات بطاقتك على خوادمنا.",
    },
  ];

  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface font-sans" dir="rtl">
      <SiteHeader />

      <main className="pt-lg pb-20 px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto min-h-screen">
        {/* Header Section */}
        <header className="text-center mb-xl max-w-3xl mx-auto">
          <h1 className="font-display-lg text-display-lg mb-md text-on-surface text-3xl md:text-5xl font-extrabold tracking-tight">
            كيف يمكننا مساعدتك اليوم؟
          </h1>
          <p className="text-on-surface-variant/75 text-body-lg">
            تواصل مع فريق الدعم الفني أو تصفّح إجابات الأسئلة الأكثر شيوعاً أدناه.
          </p>
        </header>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start mt-8">
          {/* Right Column (RTL first): Support Ticket Form */}
          <section className="lg:col-span-7 space-y-lg">
            <div className="bg-surface-container-lowest rounded-2xl p-md md:p-lg shadow-sm border border-outline-variant">
              <div className="flex items-center gap-sm mb-lg">
                <span className="material-symbols-outlined text-primary text-[32px]">
                  support_agent
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                  فتح تذكرة دعم جديدة
                </h2>
              </div>

              {!isLoading && !isAuthenticated ? (
                <div className="text-center py-lg space-y-md">
                  <span className="material-symbols-outlined text-outline text-5xl">lock</span>
                  <p className="font-body-lg text-on-surface-variant">
                    سجّل الدخول لفتح تذكرة دعم ومتابعة حالة تذاكرك السابقة.
                  </p>
                  <Link
                    href="/signin?next=/support"
                    className="inline-block bg-primary text-on-primary px-lg py-md rounded-xl font-bold font-title-lg shadow-md hover:opacity-90 active:scale-95 transition-all"
                  >
                    تسجيل الدخول
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleTicketSubmit} className="space-y-md">
                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant block pr-1">
                      نوع المشكلة
                    </label>
                    <div className="relative">
                      <select
                        value={issueType}
                        onChange={(e) => setIssueType(e.target.value as SupportTicketType)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg h-12 pr-4 pl-10 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer"
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                        expand_more
                      </span>
                    </div>
                  </div>

                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant block pr-1">
                      رقم الحجز (اختياري)
                    </label>
                    <input
                      value={bookingRef}
                      onChange={(e) => setBookingRef(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg h-12 px-md text-on-surface placeholder-on-surface-variant/30 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                      placeholder="مثال: KKJNPU"
                      type="text"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant block pr-1">
                      شرح المشكلة
                    </label>
                    <textarea
                      required
                      minLength={10}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-md text-on-surface placeholder-on-surface-variant/30 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                      placeholder="يرجى تزويدنا بكافة التفاصيل لنتمكن من مساعدتك بشكل أسرع..."
                      rows={5}
                    ></textarea>
                  </div>

                  {submitError && (
                    <div className="bg-error-container/20 border border-error text-error p-md rounded-xl text-sm">
                      {submitError}
                    </div>
                  )}
                  {submitSuccess && (
                    <div className="bg-green-500/10 border border-green-500/30 text-green-600 p-md rounded-xl text-sm font-bold flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      تم إرسال التذكرة بنجاح — ستجدها في قائمة تذاكرك أدناه وسيتواصل معك الفريق قريباً.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-14 bg-primary text-on-primary font-bold text-title-lg rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 mt-md flex items-center justify-center gap-xs cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <span className="animate-spin h-5 w-5 border-2 border-on-primary border-t-transparent rounded-full"></span>
                        <span>جاري إرسال التذكرة...</span>
                      </>
                    ) : (
                      <span>إرسال التذكرة</span>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* My tickets */}
            {isAuthenticated && ticketsLoaded && tickets.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-md md:p-lg shadow-sm border border-outline-variant">
                <div className="flex items-center gap-sm mb-md">
                  <span className="material-symbols-outlined text-primary text-[28px]">
                    confirmation_number
                  </span>
                  <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                    تذاكري السابقة
                  </h2>
                </div>
                <div className="space-y-sm">
                  {tickets.map((t) => (
                    <div key={t.id} className="border border-outline-variant/60 rounded-xl p-md space-y-xs">
                      <div className="flex flex-wrap items-center justify-between gap-xs">
                        <div className="flex items-center gap-sm">
                          <span className="font-label-md text-label-md font-bold text-on-surface">
                            {TYPE_LABELS[t.type] ?? t.type}
                          </span>
                          {t.booking_reference && (
                            <span className="font-mono text-xs text-on-surface-variant bg-surface-container px-sm py-[2px] rounded-full" dir="ltr">
                              #{t.booking_reference}
                            </span>
                          )}
                        </div>
                        <span className={`border font-label-sm text-label-sm px-sm py-[2px] rounded-full ${STATUS_BADGES[t.status].classes}`}>
                          {STATUS_BADGES[t.status].label}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{t.description}</p>
                      {t.admin_note && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-sm text-sm text-on-surface flex gap-xs items-start">
                          <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">support_agent</span>
                          <p><span className="font-bold">رد فريق الدعم:</span> {t.admin_note}</p>
                        </div>
                      )}
                      <p className="text-[11px] text-on-surface-variant/60">{formatSystemTimestamp(t.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Left Column: FAQ Accordions */}
          <section className="lg:col-span-5 space-y-md">
            <div className="flex items-center gap-sm mb-lg">
              <span className="material-symbols-outlined text-primary text-[32px]">
                quiz
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                الأسئلة الأكثر شيوعاً
              </h2>
            </div>

            <div className="space-y-base">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full p-md text-right flex justify-between items-center bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <span className="font-title-lg text-on-surface font-semibold text-base md:text-[18px]">
                      {faq.q}
                    </span>
                    <span
                      className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${
                        openFaq === index ? "rotate-180 text-primary" : ""
                      }`}
                    >
                      expand_more
                    </span>
                  </button>
                  <div
                    className={`transition-all duration-300 ease-in-out border-t border-outline-variant/40 px-md text-on-surface-variant/80 font-body-md leading-relaxed ${
                      openFaq === index
                        ? "max-h-[300px] py-md opacity-100"
                        : "max-h-0 py-0 opacity-0 overflow-hidden pointer-events-none"
                    }`}
                  >
                    {faq.a}
                  </div>
                </div>
              ))}
            </div>

            {/* Featured Card */}
            <div className="rounded-2xl overflow-hidden relative h-48 mt-lg group shadow-md border border-outline-variant">
              <Image
                alt="فريق دعم سفريات"
                src="/images/hero/hero-2.jpg"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/50 to-transparent"></div>
              <div className="absolute bottom-4 right-4 left-4 z-10">
                <p className="font-label-md text-green-300 font-bold mb-1">خدمة عملاء مميزة</p>
                <p className="font-title-lg text-white text-[18px] md:text-xl font-bold leading-tight">
                  نحن معك على مدار الساعة أينما كنت
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
