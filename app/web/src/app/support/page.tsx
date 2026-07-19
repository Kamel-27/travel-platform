"use client";

import { useState } from "react";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

interface FileItem {
  name: string;
  size: string;
}

export default function HelpSupportPage() {
  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Form State
  const [issueType, setIssueType] = useState("إلغاء حجز");
  const [bookingRef, setBookingRef] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<FileItem[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Drag and Drop simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).map((file) => ({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      }));
      setAttachments((prev) => [...prev, ...filesArray]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files).map((file) => ({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      }));
      setAttachments((prev) => [...prev, ...filesArray]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Ticket Simulation
  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setBookingRef("");
      setDescription("");
      setAttachments([]);
      alert("تم إرسال تذكرة الدعم بنجاح! سيقوم فريق خدمة العملاء بالتواصل معك قريباً.");
    }, 2000);
  };



  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "كيف يمكنني استرجاع مبلغ الحجز؟",
      a: "يمكنك طلب الاسترجاع عبر الدخول إلى 'رحلاتي'، اختيار الرحلة المراد إلغاؤها، ثم النقر على 'طلب استرداد'. يرجى ملاحظة أن الرسوم تعتمد على سياسة شركة الطيران أو الفندق المختارة أثناء الحجز.",
    },
    {
      q: "طريقة تعديل اسم المسافر وطريقة التواصل",
      a: "تعديل الأسماء يخضع لشروط صارمة من قبل شركات الطيران. نوصي بالتواصل الفوري مع الدعم الفني عبر نموذج التذاكر على هذه الصفحة أو الدردشة المباشرة لتجنب أي رسوم إضافية قد تفرضها الناقلة.",
    },
    {
      q: "سياسة الأمتعة الإضافية والأسعار",
      a: "يمكنك إضافة أمتعة زائدة بأسعار مخفضة حتى 24 ساعة قبل موعد الإقلاع من خلال تطبيق سفريات أو البوابة الإلكترونية. الأسعار تختلف حسب الوجهة ووزن الحقيبة المضافة.",
    },
    {
      q: "ما هي خيارات الدفع المتاحة؟",
      a: "نحن ندعم مجموعة واسعة من خيارات الدفع الآمنة بما في ذلك بطاقات مدى البنكية، فيزا، ماستركارد، Apple Pay، والتحويل البنكي المباشر مع توفر خيارات التقسيط بدون فوائد.",
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
          {/* Left Column: Support Ticket Form */}
          <section className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-md md:p-lg shadow-sm border border-outline-variant">
            <div className="flex items-center gap-sm mb-lg">
              <span className="material-symbols-outlined text-primary text-[32px]">
                support_agent
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                فتح تذكرة دعم جديدة
              </h2>
            </div>
            
            <form onSubmit={handleTicketSubmit} className="space-y-md">
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block pr-1">
                  نوع المشكلة
                </label>
                <div className="relative">
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg h-12 pr-4 pl-10 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer"
                  >
                    <option value="إلغاء حجز">إلغاء حجز</option>
                    <option value="تأخير رحلة">تأخير رحلة</option>
                    <option value="تعديل اسم المسافر">تعديل اسم المسافر</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block pr-1">
                  رقم الحجز
                </label>
                <input
                  required
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg h-12 px-md text-on-surface placeholder-on-surface-variant/30 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="مثال: SAF-98249-RUH"
                  type="text"
                />
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block pr-1">
                  شرح المشكلة
                </label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-md text-on-surface placeholder-on-surface-variant/30 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  placeholder="يرجى تزويدنا بكافة التفاصيل لنتمكن من مساعدتك بشكل أسرع..."
                  rows={5}
                ></textarea>
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant block pr-1">
                  المرفقات (اختياري)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-outline-variant rounded-xl p-lg text-center hover:bg-surface-container-low transition-colors cursor-pointer group relative"
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="material-symbols-outlined text-outline text-[48px] group-hover:text-primary transition-colors">
                    upload_file
                  </span>
                  <p className="text-on-surface-variant font-body-md mt-base font-medium">
                    اسحب وأفلت صور الجوازات أو الإيصالات هنا أو انقر للتصفح
                  </p>
                  <p className="text-on-surface-variant/50 text-label-sm mt-xs">
                    الحد الأقصى للحجم 5MB لكل ملف
                  </p>
                </div>

                {/* Attachments List */}
                {attachments.length > 0 && (
                  <div className="mt-md space-y-sm bg-surface-container rounded-xl p-md border border-outline-variant">
                    <p className="font-label-md text-label-md text-on-surface-variant font-bold">
                      الملفات المرفقة ({attachments.length}):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center bg-surface-container-lowest p-sm rounded-lg border border-outline-variant/60"
                        >
                          <div className="flex items-center gap-xs truncate pl-2">
                            <span className="material-symbols-outlined text-primary text-[20px]">
                              description
                            </span>
                            <span className="font-label-sm text-label-sm text-on-surface truncate">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-outline">({file.size})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="text-error hover:bg-error/10 p-1 rounded-full shrink-0 flex items-center justify-center transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitted}
                className="w-full h-14 bg-primary text-on-primary font-bold text-title-lg rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 mt-md flex items-center justify-center gap-xs cursor-pointer"
              >
                {submitted ? (
                  <>
                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                    <span>جاري إرسال التذكرة...</span>
                  </>
                ) : (
                  <span>إرسال التذكرة</span>
                )}
              </button>
            </form>
          </section>

          {/* Right Column: FAQ Accordions */}
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
