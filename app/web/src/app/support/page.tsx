"use client";

import { useState } from "react";
import Link from "next/link";

interface FileItem {
  name: string;
  size: string;
}

interface Message {
  sender: "user" | "bot";
  text: string;
  time: string;
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

  // AI Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "أهلاً بك في سفريات! أنا مساعدك الذكي المتصل بالذكاء الاصطناعي. كيف يمكنني مساعدتك اليوم؟",
      time: "الآن",
    },
  ]);

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

  // Chat message submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    const timeNow = new Date().toLocaleTimeString("ar-SA", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMessage: Message = {
      sender: "user",
      text: userMsg,
      time: timeNow,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    // Simulate AI response delay
    setTimeout(() => {
      let botResponse = "شكرًا لتواصلك معنا. يقوم النظام حالياً بالبحث في قاعدة بيانات الحجوزات الخاصة بك للإجابة بدقة.";
      
      if (userMsg.includes("حجز") || userMsg.includes("إلغاء")) {
        botResponse = "لإلغاء حجزك أو استرداد قيمته، يمكنك استخدام نموذج فتح التذكرة على هذه الصفحة برقم حجزك، أو التوجه إلى قسم 'رحلاتي' لتقديم طلب إلغاء فوري.";
      } else if (userMsg.includes("تعديل") || userMsg.includes("اسم")) {
        botResponse = "تعديل الأسماء أو البيانات الشخصية يخضع لسياسات شركات الطيران. يرجى تزويدنا برقم حجزك وصورة من جواز السفر عبر نموذج التذاكر للقيام بالتحديث فوراً وبدون رسوم إضافية إن أمكن.";
      } else if (userMsg.includes("أمتعة") || userMsg.includes("وزن") || userMsg.includes("حقيبة")) {
        botResponse = "يمكنك إضافة أمتعة وحقائب إضافية بخصم يصل إلى 40% قبل موعد إقلاع رحلتك بـ 24 ساعة من خلال لوحة التحكم الخاصة بالحجز في قسم 'رحلاتي'.";
      } else if (userMsg.includes("مرحبا") || userMsg.includes("أهلاً") || userMsg.includes("السلام")) {
        botResponse = "أهلاً بك! أنا هنا لمساعدتك في أي استفسار يخص رحلاتك، فنادقك، أو الدفع والتعويضات. كيف يمكنني خدمتك؟";
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: botResponse,
          time: timeNow,
        },
      ]);
    }, 1000);
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
      {/* TopNavBar */}
      <header className="fixed top-0 z-50 w-full bg-surface-container-lowest dark:bg-inverse-surface shadow-sm h-16 flex items-center border-b border-outline-variant">
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
              <Link className="font-label-md text-label-md text-primary font-bold transition-colors" href="/support">
                مركز المساعدة
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
            <Link href="/signin" className="bg-primary text-white px-md py-xs rounded-lg font-label-md text-label-md scale-98 active:scale-95 transition-transform duration-200">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto min-h-screen">
        {/* Header Section */}
        <header className="text-center mb-xl max-w-3xl mx-auto">
          <h1 className="font-display-lg text-display-lg mb-md text-on-surface text-3xl md:text-5xl font-extrabold tracking-tight">
            كيف يمكننا مساعدتك اليوم؟
          </h1>
          <p className="text-on-surface-variant/75 text-body-lg mb-lg">
            ابحث عن إجابات سريعة، تواصل مع فريق الدعم الفني، أو دردش مع المساعد الذكي.
          </p>
          <div className="relative group max-w-2xl mx-auto">
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              className="w-full h-16 pr-14 pl-6 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-body-lg font-body-lg shadow-sm"
              placeholder="ابحث عن إجابات سريعة، رقم الحجز، أو سياسات السفر..."
              type="text"
            />
          </div>
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
                          className="flex justify-between items-center bg-white p-sm rounded-lg border border-outline-variant/60"
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
                className="w-full h-14 bg-primary text-white font-bold text-title-lg rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 mt-md flex items-center justify-center gap-xs cursor-pointer"
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
                  className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden transition-all duration-300"
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
              <img
                alt="Support Visual"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD-id6twMKtcK_QeWWtn6TcmQZEBL9pMZlWq-8seAA-z_LIOIccYDyWsFYo3piJOD7gGVCQFy5V9LdqwtoJSM1nwuQh1YkXN2V4ANlIOmzAeK63TpoRfw11xe9IBC-4RO60_vQXsWHQdWbMmBccpjG-4yxneo2_rlxABfYbI3hTMbjn7U_SQs9hUXq3Nzi0vEl9Ent3R2In5ri56OKDIzrIuMRasRfbOf-Y-2aSHB2NidDRL9BEh1M6M4E6NtxHnZONSXLkggQusXWT"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/50 to-transparent"></div>
              <div className="absolute bottom-4 right-4 left-4 z-10">
                <p className="font-label-md text-green-300 font-bold mb-1">خدمة عملاء مميزة</p>
                <p className="font-title-lg text-white text-[18px] md:text-xl font-bold leading-tight">
                  نحن معك على مدار الساعة في 120 دولة
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Floating UI: Chat with AI */}
      <div className="fixed bottom-6 left-6 z-[9999] font-sans">
        {/* Toggle Widget */}
        {!isChatOpen && (
          <div
            onClick={() => setIsChatOpen(true)}
            className="bg-white/95 dark:bg-zinc-900/95 p-3 rounded-2xl shadow-xl flex items-center gap-md border border-outline-variant hover:border-primary hover:scale-[1.03] transition-all cursor-pointer group"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                  smart_toy
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
            </div>
            <div className="hidden sm:block pl-2">
              <p className="font-label-md text-on-surface leading-none font-bold">تحدث مع المساعد الذكي</p>
              <p className="text-label-sm text-green-600 mt-1 font-medium flex items-center gap-1">
                <span>متصل الآن - استجابة فورية</span>
              </p>
            </div>
            <span className="material-symbols-outlined text-outline group-hover:text-primary mr-base text-lg transition-transform group-hover:-translate-x-1">
              arrow_back_ios
            </span>
          </div>
        )}

        {/* Chat Window Dialog */}
        {isChatOpen && (
          <div className="w-[360px] sm:w-[400px] h-[500px] bg-white rounded-2xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden animate-fade-in text-on-surface">
            {/* Chat Header */}
            <div className="bg-primary text-white p-4 flex justify-between items-center shrink-0 shadow-md">
              <div className="flex items-center gap-sm">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                      smart_toy
                    </span>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-400 border-2 border-primary rounded-full"></span>
                </div>
                <div>
                  <p className="font-bold text-base leading-tight">المساعد الذكي لسفريات</p>
                  <p className="text-[11px] text-green-200">يجيبك فوراً بالذكاء الاصطناعي</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white hover:bg-white/10 p-1.5 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto bg-surface-container-low space-y-md flex flex-col">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col max-w-[80%] ${
                    msg.sender === "user" ? "self-start items-start" : "self-end items-end"
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                      msg.sender === "user"
                        ? "bg-primary text-white rounded-tr-none"
                        : "bg-white text-on-surface rounded-tl-none border border-outline-variant/40"
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                  <span className="text-[10px] text-outline mt-1 px-1">{msg.time}</span>
                </div>
              ))}
            </div>

            {/* Chat Input Footer */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-outline-variant flex gap-sm shrink-0">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                type="text"
              />
              <button
                type="submit"
                className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow hover:bg-primary/90 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] rotate-180">send</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full py-lg px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-center gap-base bg-surface-container border-t border-outline-variant">
        <div className="flex flex-col items-center md:items-start gap-xs">
          <span className="font-headline-md text-headline-md font-extrabold text-primary">سفريات</span>
          <p className="text-on-secondary-container font-label-sm text-label-sm">
            © 2026 سفريات. جميع الحقوق محفوظة.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-md">
          <Link className="text-on-secondary-container font-label-sm text-label-sm hover:text-primary transition-opacity opacity-80 hover:opacity-100" href="/about">
            عن سفريات
          </Link>
          <Link className="text-on-secondary-container font-label-sm text-label-sm hover:text-primary transition-opacity opacity-80 hover:opacity-100" href="/privacy">
            سياسة الخصوصية
          </Link>
          <Link className="text-on-secondary-container font-label-sm text-label-sm hover:text-primary transition-opacity opacity-80 hover:opacity-100" href="/terms">
            الشروط والأحكام
          </Link>
          <Link className="text-on-secondary-container font-label-sm text-label-sm hover:text-primary transition-opacity opacity-80 hover:opacity-100" href="/support">
            اتصل بنا
          </Link>
          <Link className="text-on-secondary-container font-label-sm text-label-sm hover:text-primary transition-opacity opacity-80 hover:opacity-100" href="/support">
            الأسئلة الشائعة
          </Link>
        </div>
      </footer>
    </div>
  );
}
