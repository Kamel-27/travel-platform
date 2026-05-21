"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SecurePaymentPage() {
  const [paymentMethod, setPaymentMethod] = useState("credit_card"); // credit_card, apple_pay, wallet
  const [timeLeft, setTimeLeft] = useState(14 * 60 + 59);

  // Countdown timer logic
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Card input states
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [saveCard, setSaveCard] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b1120] text-white font-sans overflow-x-hidden relative" dir="rtl">
      {/* Decorative Radial Backgrounds */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-tertiary/5 blur-[120px] pointer-events-none z-0"></div>

      <header className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto h-16">
          <Link href="/" className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary-fixed-dim">
            سفريات
          </Link>
          <div className="flex items-center gap-xs font-label-md text-label-md text-orange-400">
            <span className="material-symbols-outlined !text-[18px]">timer</span>
            <span>بوابة الدفع الآمنة</span>
          </div>
        </div>
      </header>

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-xl relative z-10">
        {/* Secure Header */}
        <div className="flex flex-col items-center mb-lg">
          <div className="bg-primary/20 p-sm rounded-full mb-base border border-primary/40 shadow-[0_0_20px_rgba(0,85,204,0.15)]">
            <span className="material-symbols-outlined text-primary-fixed-dim !text-[32px]">lock</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-white mb-xs text-center">بوابة الدفع الآمنة</h1>
          <div className="flex items-center gap-xs font-label-md text-label-md text-orange-400 font-bold bg-orange-400/10 px-md py-sm rounded-full border border-orange-400/20 shadow-sm animate-pulse">
            <span className="material-symbols-outlined !text-[18px]">timer</span>
            <span>تبقي {formatTime()} لإكمال الحجز</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
          {/* Left: Payment Form */}
          <div className="lg:col-span-8 order-2 lg:order-1">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-md md:p-lg shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              
              {/* Payment Tabs */}
              <div className="flex flex-wrap gap-base mb-lg">
                <button
                  onClick={() => setPaymentMethod("credit_card")}
                  className={`flex-1 min-w-[140px] flex items-center justify-center gap-sm p-md rounded-xl transition-all font-label-md border-2 font-bold cursor-pointer ${
                    paymentMethod === "credit_card"
                      ? "bg-white text-primary border-white"
                      : "bg-white/[0.02] border-white/10 text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined">credit_card</span>
                  <span>بطاقة ائتمانية / مدى</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("apple_pay")}
                  className={`flex-1 min-w-[140px] flex items-center justify-center gap-sm p-md rounded-xl transition-all font-label-md border-2 font-bold cursor-pointer ${
                    paymentMethod === "apple_pay"
                      ? "bg-white text-black border-white"
                      : "bg-white/[0.02] border-white/10 text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined">ios</span>
                  <span>Apple Pay</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("wallet")}
                  className={`flex-1 min-w-[140px] flex items-center justify-center gap-sm p-md rounded-xl transition-all font-label-md border-2 font-bold cursor-pointer ${
                    paymentMethod === "wallet"
                      ? "bg-white text-primary border-white"
                      : "bg-white/[0.02] border-white/10 text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  <span>الدفع بالمحفظة</span>
                </button>
              </div>

              {/* Render dynamic payment forms based on selected method */}
              {paymentMethod === "credit_card" && (
                <div className="space-y-md">
                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-surface-variant block">رقم البطاقة</label>
                    <div className="relative">
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-md text-white placeholder:text-white/20 text-left"
                        dir="ltr"
                        placeholder="**** **** **** ****"
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                      />
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-white/40">credit_card</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-surface-variant block">اسم صاحب البطاقة</label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-md text-white placeholder:text-white/20"
                      placeholder="الاسم بالكامل كما هو مكتوب على البطاقة"
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-md">
                    <div className="space-y-xs">
                      <label className="font-label-md text-label-md text-surface-variant block">تاريخ الانتهاء</label>
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-md text-white placeholder:text-white/20 text-center"
                        placeholder="MM / YY"
                        type="text"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-xs">
                      <label className="font-label-md text-label-md text-surface-variant block">رمز الأمان (CVV)</label>
                      <div className="relative">
                        <input
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-md text-white placeholder:text-white/20 text-center"
                          placeholder="***"
                          type="password"
                          maxLength={3}
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                        />
                        <span className="absolute inset-y-0 left-4 flex items-center">
                          <span className="material-symbols-outlined text-white/40 cursor-help" title="الرمز المكون من 3 أرقام خلف البطاقة">help_outline</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-base pt-base">
                    <input
                      className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary-container"
                      id="save-card"
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                    />
                    <label className="font-body-md text-body-md text-surface-variant cursor-pointer select-none" htmlFor="save-card">
                      حفظ بيانات البطاقة لعمليات الدفع القادمة بأمان
                    </label>
                  </div>
                </div>
              )}

              {paymentMethod === "apple_pay" && (
                <div className="py-xl flex flex-col items-center justify-center gap-md">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-black shadow-lg">
                    <span className="material-symbols-outlined text-4xl">ios</span>
                  </div>
                  <p className="font-body-lg text-body-lg text-center text-white/80">ادفع بلمسة واحدة باستخدام Apple Pay بأمان تام</p>
                  <Link href="/checkout/confirmation" className="bg-white text-black font-bold font-title-lg px-xl py-md rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-md flex items-center gap-xs">
                    <span>الدفع باستخدام</span>
                    <span className="font-extrabold flex items-center text-xl font-mono"> Pay</span>
                  </Link>
                </div>
              )}

              {paymentMethod === "wallet" && (
                <div className="py-xl flex flex-col items-center justify-center gap-md">
                  <div className="w-20 h-20 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.1)]">
                    <span className="material-symbols-outlined text-4xl">account_balance_wallet</span>
                  </div>
                  <div className="text-center">
                    <p className="font-body-lg text-body-lg text-white/80">رصيد محفظتك الرقمية الحالي هو:</p>
                    <p className="font-headline-lg text-headline-lg text-teal-400 font-bold mt-xs">2,450 SAR</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-md max-w-sm text-center">
                    <p className="font-label-sm text-label-sm text-white/60">سيتم خصم قيمة الحجز (1,430 SAR) مباشرة من رصيد المحفظة.</p>
                  </div>
                  <Link href="/checkout/confirmation" className="bg-teal-500 hover:bg-teal-600 active:scale-95 text-white font-bold font-title-lg px-xl py-md rounded-xl transition-all shadow-md text-center">
                    تأكيد الدفع من المحفظة
                  </Link>
                </div>
              )}

            </div>

            {/* Trusted Badges */}
            <div className="mt-lg flex flex-wrap justify-center gap-xl opacity-60 hover:opacity-100 transition-opacity duration-300">
              <span className="font-label-sm text-label-sm text-white/40 block w-full text-center mb-xs">نحن نقبل وسائل الدفع الآمنة التالية:</span>
              <img alt="Mada" className="h-8 object-contain bg-white/5 p-1 rounded border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGdmBBcn4FH0n5-kbQ3gTzYctyPMvh-dRZGxnGekg_55xvuKoYO8LhbgmTHTkskr15ulzASzZ3onh0pde0UpCMgNoVdjjYtJldZDGD-tiRiXGYXNNy6zNhLd8taAw2yQ4mH2ath0kaW7m29C5HpZ0sWG9wf5SL4ABnowlsWpjh-5lUl37gdrqEiSENOwzHweCNIZ_z2FHMs84uF17qfdSedSRjnR5KRcaExLLAx6dHwP1PDtVz_o4JggEspEEQ3kIyGC9yrnfpTfWj" />
              <img alt="Visa" className="h-8 object-contain bg-white/5 p-1 rounded border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCl4QjnGied3_oQ4Qr0DmJqamx-BUrkRn94c2XPKZdZa-KaGHn829apK4FFDiZ2agW81Lq2gNf33umzPTewwMIFxKs-xqynp9628sWLGbc151ozWkc_gZ5hDM_pnmXr4ptLIUVOSANP6dgGHsVEIJqT7Ob0hWydGFAaB-kLiYMOjOgBBymHjI5TU6Jh8B36Y39ZoNMmvyJHpdPTL4P7XWFzpTmNQsmfcaNusVn-Px_ITJZHQ4cqY-sScj5-CIE5wHqmh5ZXe6-LBzX0" />
              <img alt="Mastercard" className="h-8 object-contain bg-white/5 p-1 rounded border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfz7XNwx-fH1QJEntBlu_jJP98rkSxlWKyXiSDHXP2JmUYs60FbiZBQ48Ef0v0VcijjZVUMIHu1JEbAI6b0kfLr3MEbM21cmseQQkY2vmZISJ9pq8_ENW6rz7b3doEqVn8hqNDC8BhVNiGUCzRbW1lBuaPfj-iRpsDM0YDvMXJIdUMR8RayjcJlK89qjlH9sI1aLdYfP1GWpEfozqIxD1cJm0Y81kydM2PrgLiiIPvpVUfGRxefQvZa1suWZ_qg6SNWn3oBinfFQGd" />
            </div>
          </div>

          {/* Right: Summary Panel */}
          <div className="lg:col-span-4 order-1 lg:order-2">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-md md:p-lg shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] sticky top-24">
              <h2 className="font-title-lg text-title-lg text-white mb-md font-bold border-b border-white/10 pb-sm">تفاصيل الحجز</h2>
              <div className="space-y-sm pb-md border-b border-white/10">
                <div className="flex justify-between font-body-md text-body-md text-white/70">
                  <span>سعر التذكرة الأساسي</span>
                  <span>1,250 SAR</span>
                </div>
                <div className="flex justify-between font-body-md text-body-md text-white/70">
                  <span>ضريبة القيمة المضافة (15%)</span>
                  <span>180 SAR</span>
                </div>
                <div className="flex justify-between font-body-md text-body-md text-white/70">
                  <span>رسوم الدفع والخدمة الآمنة</span>
                  <span className="text-teal-400">مجاناً</span>
                </div>
              </div>
              <div className="py-md">
                <div className="flex justify-between items-center">
                  <span className="font-title-lg text-title-lg text-white font-bold">الإجمالي الكلي</span>
                  <span className="font-headline-md text-headline-md text-orange-400 font-extrabold shadow-orange-400">1,430 SAR</span>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-xl p-base mt-xs flex gap-base items-start border border-white/10">
                <span className="material-symbols-outlined text-teal-400 mt-0.5 shrink-0">info</span>
                <p className="font-label-sm text-label-sm text-white/60">جميع الضرائب والرسوم مشمولة بالكامل في السعر النهائي. لن يتم تطبيق أي رسوم مخفية لاحقاً.</p>
              </div>

              {/* Secure Checkout Button */}
              <Link
                href="/checkout/confirmation"
                className="w-full mt-lg bg-orange-400 hover:bg-orange-500 active:scale-95 transition-all text-on-tertiary-fixed font-title-lg p-md rounded-xl flex items-center justify-center gap-base font-bold shadow-md shadow-orange-400/20"
              >
                <span className="material-symbols-outlined">security</span>
                <span>ادفع الآن بأمان</span>
              </Link>
              
              <div className="mt-md flex items-center justify-center gap-xs text-white/40">
                <span className="material-symbols-outlined !text-[14px]">verified_user</span>
                <span className="font-label-sm text-label-sm">تشفير وحماية 256-بت SSL</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-lg px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-center gap-base border-t border-white/10 mt-xl opacity-60 text-white">
        <div className="font-headline-md text-headline-md font-extrabold text-primary-fixed-dim">Safariyat</div>
        <div className="flex gap-md">
          <Link className="font-label-sm text-label-sm hover:text-orange-400 transition-colors" href="/">عن سفريات</Link>
          <Link className="font-label-sm text-label-sm hover:text-orange-400 transition-colors" href="/">سياسة الخصوصية</Link>
          <Link className="font-label-sm text-label-sm hover:text-orange-400 transition-colors" href="/support">اتصل بنا</Link>
        </div>
        <div className="font-label-sm text-label-sm text-white/40">© 2026 سفريات. جميع الحقوق محفوظة.</div>
      </footer>
    </div>
  );
}
