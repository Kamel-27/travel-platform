"use client";

import { useState } from "react";
import Link from "next/link";

export default function CheckoutPage() {
  const [passenger, setPassenger] = useState({
    firstName: "",
    lastName: "",
    passportNumber: "",
    passportExpiry: "",
    birthDate: "",
  });

  const [contact, setContact] = useState({
    email: "",
    phone: "",
  });

  // Extras pricing states
  const [insurance, setInsurance] = useState(false);
  const [extraBaggage, setExtraBaggage] = useState(false);
  const [hotMeals, setHotMeals] = useState(false);

  // Pricing calculations
  const baseFlightPrice = 1250;
  const flightTaxes = 180;
  const insurancePrice = 75;
  const baggagePrice = 150;
  const mealsPrice = 60;

  const getExtrasTotal = () => {
    let total = 0;
    if (insurance) total += insurancePrice;
    if (extraBaggage) total += baggagePrice;
    if (hotMeals) total += mealsPrice;
    return total;
  };

  const totalPrice = baseFlightPrice + flightTaxes + getExtrasTotal();

  const handlePassengerChange = (field: string, value: string) => {
    setPassenger((prev) => ({ ...prev, [field]: value }));
  };

  const handleContactChange = (field: string, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans" dir="rtl">
      {/* TopNavBar */}
      <header className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm sticky top-0 z-50 border-b border-outline-variant">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto h-16">
          <div className="flex items-center gap-md">
            <Link href="/" className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary">
              سفريات
            </Link>
            <nav className="hidden md:flex items-center gap-base">
              <Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors px-xs" href="/flights">
                رحلات طيران
              </Link>
              <Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors px-xs" href="/hotels">
                فنادق
              </Link>
              <Link className="text-on-surface-variant dark:text-surface-variant font-label-md text-label-md hover:text-primary transition-colors px-xs" href="/support">
                الدعم والمساعدة
              </Link>
              <Link className="text-primary dark:text-inverse-primary font-bold border-b-2 border-primary dark:border-inverse-primary pb-1 font-label-md text-label-md px-xs" href="/manage-bookings">
                رحلاتي
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-sm">
            <div className="hidden md:flex items-center gap-xs text-on-surface-variant">
              <span className="material-symbols-outlined hover:text-primary cursor-pointer">language</span>
              <span className="material-symbols-outlined hover:text-primary cursor-pointer">currency_exchange</span>
              <span className="material-symbols-outlined hover:text-primary cursor-pointer">notifications</span>
            </div>
            <Link href="/signin" className="bg-primary text-on-primary px-md py-xs rounded-lg font-label-md text-label-md scale-98 active:scale-95 transition-all text-center">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop pt-lg pb-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
          {/* Right Column: Form (Main Action) */}
          <div className="lg:col-span-8 space-y-md">
            <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-base">إتمام بيانات الحجز</h1>
            
            {/* Section 1: Passenger Details */}
            <section className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center gap-sm mb-md border-b border-outline-variant/30 pb-sm">
                <span className="material-symbols-outlined text-primary text-2xl">person</span>
                <h2 className="font-title-lg text-title-lg font-bold">بيانات المسافر 1 (بالغ)</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant block font-medium">الاسم الأول بالإنجليزية</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">badge</span>
                    <input 
                      className="w-full pr-10 pl-4 py-3 bg-surface rounded-lg border border-outline-variant font-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                      placeholder="e.g. MOHAMMED" 
                      type="text"
                      value={passenger.firstName}
                      onChange={(e) => handlePassengerChange("firstName", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant block font-medium">اسم العائلة بالإنجليزية</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">badge</span>
                    <input 
                      className="w-full pr-10 pl-4 py-3 bg-surface rounded-lg border border-outline-variant font-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                      placeholder="e.g. ALOTAIBI" 
                      type="text"
                      value={passenger.lastName}
                      onChange={(e) => handlePassengerChange("lastName", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant block font-medium">رقم جواز السفر</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">travel</span>
                    <input 
                      className="w-full pr-10 pl-4 py-3 bg-surface rounded-lg border border-outline-variant font-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                      placeholder="e.g. L1234567" 
                      type="text"
                      value={passenger.passportNumber}
                      onChange={(e) => handlePassengerChange("passportNumber", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant block font-medium">تاريخ انتهاء الجواز</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">event</span>
                    <input 
                      className="w-full pr-10 pl-4 py-3 bg-surface rounded-lg border border-outline-variant font-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                      type="date"
                      value={passenger.passportExpiry}
                      onChange={(e) => handlePassengerChange("passportExpiry", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-xs md:col-span-2">
                  <label className="font-label-md text-label-md text-on-surface-variant block font-medium">تاريخ الميلاد</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">cake</span>
                    <input 
                      className="w-full pr-10 pl-4 py-3 bg-surface rounded-lg border border-outline-variant font-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                      type="date"
                      value={passenger.birthDate}
                      onChange={(e) => handlePassengerChange("birthDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </section>
            
            {/* Section 2: Contact Information */}
            <section className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center gap-sm mb-md border-b border-outline-variant/30 pb-sm">
                <span className="material-symbols-outlined text-primary text-2xl">contact_mail</span>
                <h2 className="font-title-lg text-title-lg font-bold">معلومات التواصل</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant block font-medium">البريد الإلكتروني</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">mail</span>
                    <input 
                      className="w-full pr-10 pl-4 py-3 bg-surface rounded-lg border border-outline-variant font-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary text-right" 
                      placeholder="example@email.com" 
                      type="email"
                      value={contact.email}
                      onChange={(e) => handleContactChange("email", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant block font-medium">رقم الهاتف</label>
                  <div className="flex gap-xs" dir="ltr">
                    <div className="w-24 bg-surface border border-outline-variant rounded-lg flex items-center justify-center gap-xs font-body-md text-on-surface">
                      <span className="material-symbols-outlined text-sm">flag</span>
                      <span>+966</span>
                    </div>
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">phone</span>
                      <input 
                        className="w-full pr-10 pl-4 py-3 bg-surface rounded-lg border border-outline-variant font-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary text-left" 
                        placeholder="50XXXXXXX" 
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => handleContactChange("phone", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
            
            {/* Section 3: Extra Services */}
            <section className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center gap-sm mb-md border-b border-outline-variant/30 pb-sm">
                <span className="material-symbols-outlined text-primary text-2xl">add_moderator</span>
                <h2 className="font-title-lg text-title-lg font-bold">خدمات إضافية</h2>
              </div>
              <div className="space-y-base">
                {/* Toggle 1 */}
                <div className="flex items-center justify-between p-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-secondary text-2xl">health_and_safety</span>
                    <div>
                      <p className="font-body-md text-body-md font-bold">تأمين السفر (+{insurancePrice} SAR)</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">تغطية طبية وحوادث طارئة طوال مدة الرحلة</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      className="sr-only peer" 
                      type="checkbox"
                      checked={insurance}
                      onChange={(e) => setInsurance(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                {/* Toggle 2 */}
                <div className="flex items-center justify-between p-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-secondary text-2xl">luggage</span>
                    <div>
                      <p className="font-body-md text-body-md font-bold">حقيبة إضافية 23 كجم (+{baggagePrice} SAR)</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">أضف وزناً إضافياً مريحاً لمشترياتك واحتياجاتك</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      className="sr-only peer" 
                      type="checkbox"
                      checked={extraBaggage}
                      onChange={(e) => setExtraBaggage(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                {/* Toggle 3 */}
                <div className="flex items-center justify-between p-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-secondary text-2xl">restaurant</span>
                    <div>
                      <p className="font-body-md text-body-md font-bold">وجبات ساخنة بريميوم (+{mealsPrice} SAR)</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">اختر وجبتك المفضلة اللذيذة من قائمتنا الجوية</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      className="sr-only peer" 
                      type="checkbox"
                      checked={hotMeals}
                      onChange={(e) => setHotMeals(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </section>
            
            {/* Bottom CTA Desktop */}
            <div className="hidden lg:flex justify-end pt-base">
              <Link 
                href="/checkout/payment" 
                className="bg-primary text-on-primary px-12 py-4 rounded-xl font-headline-md text-headline-md flex items-center gap-base hover:bg-primary-container active:scale-95 transition-all shadow-md font-bold"
              >
                <span>الاستمرار إلى الدفع</span>
                <span className="material-symbols-outlined">lock</span>
              </Link>
            </div>
          </div>

          {/* Left Column: Sticky Summary */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 flex flex-col gap-md">
              {/* Flight Card */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-sm border-b border-outline-variant/30 pb-sm">
                  <span className="font-headline-md text-headline-md text-primary font-bold">ملخص رحلتك</span>
                  <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-1 rounded">طيران الرياض</span>
                </div>
                <div className="flex justify-between items-center mb-base mt-md">
                  <div className="text-right">
                    <p className="font-headline-md text-headline-md font-bold text-on-surface">RUH</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">الرياض</p>
                    <p className="font-title-lg text-title-lg mt-xs font-bold text-on-surface">08:00 ص</p>
                  </div>
                  <div className="flex flex-col items-center flex-1 px-base">
                    <span className="font-label-sm text-label-sm text-on-surface-variant mb-1">2س 15د</span>
                    <div className="w-full h-[2px] bg-outline-variant relative">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-primary bg-white"></div>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-primary bg-white"></div>
                      <span className="material-symbols-outlined absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-primary text-xl">flight_takeoff</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">مباشر</span>
                  </div>
                  <div className="text-left">
                    <p className="font-headline-md text-headline-md font-bold text-on-surface">DXB</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">دبي</p>
                    <p className="font-title-lg text-title-lg mt-xs font-bold text-on-surface">11:15 ص</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-sm py-base border-t border-outline-variant/30 mt-md pt-sm">
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-outline text-lg">person</span>
                    <span className="font-label-md text-label-md text-on-surface">مسافر 1</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-outline text-lg">luggage</span>
                    <span className="font-label-md text-label-md text-on-surface">23 كجم + حقيبة يد</span>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
                <h3 className="font-title-lg text-title-lg mb-md font-bold border-b border-outline-variant/30 pb-sm">ملخص السعر</h3>
                <div className="space-y-sm mb-md">
                  <div className="flex justify-between font-body-md text-body-md">
                    <span className="text-on-surface-variant">سعر التذكرة (بالغ ×1)</span>
                    <span className="text-on-surface">{baseFlightPrice.toLocaleString()} SAR</span>
                  </div>
                  <div className="flex justify-between font-body-md text-body-md">
                    <span className="text-on-surface-variant">الضرائب والرسوم</span>
                    <span className="text-on-surface">{flightTaxes.toLocaleString()} SAR</span>
                  </div>

                  {/* Extras Breakdown */}
                  {(insurance || extraBaggage || hotMeals) && (
                    <div className="border-t border-dashed border-outline-variant/40 pt-sm space-y-sm">
                      <p className="font-label-sm text-label-sm text-outline font-bold">الخدمات الإضافية المختارة:</p>
                      {insurance && (
                        <div className="flex justify-between font-body-md text-body-md text-secondary">
                          <span>تأمين السفر</span>
                          <span>{insurancePrice} SAR</span>
                        </div>
                      )}
                      {extraBaggage && (
                        <div className="flex justify-between font-body-md text-body-md text-secondary">
                          <span>حقيبة إضافية 23 كجم</span>
                          <span>{baggagePrice} SAR</span>
                        </div>
                      )}
                      {hotMeals && (
                        <div className="flex justify-between font-body-md text-body-md text-secondary">
                          <span>وجبات ساخنة بريميوم</span>
                          <span>{mealsPrice} SAR</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between font-body-md text-body-md pt-sm border-t border-outline-variant font-bold text-title-lg">
                    <span>الإجمالي الكلي</span>
                    <span className="text-primary font-bold text-2xl">{totalPrice.toLocaleString()} SAR</span>
                  </div>
                </div>
                
                <div className="space-y-xs pt-base border-t border-outline-variant/30">
                  <label className="font-label-md text-label-md text-on-surface-variant block font-medium">هل لديك كوبون خصم؟</label>
                  <div className="flex gap-xs">
                    <input className="flex-1 px-4 py-2 bg-surface rounded-lg border border-outline-variant font-body-md outline-none focus:border-primary text-center" placeholder="أدخل الرمز" type="text"/>
                    <button className="bg-secondary text-on-secondary px-4 py-2 rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 transition-colors">تطبيق</button>
                  </div>
                </div>
              </div>

              {/* Trust/Security Info */}
              <div className="bg-surface-container-low p-sm rounded-lg flex items-start gap-sm border border-outline-variant/30">
                <span className="material-symbols-outlined text-tertiary mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                <p className="font-label-sm text-label-sm text-on-surface-variant leading-tight">جميع معاملاتك مشفرة وآمنة بنسبة 100% وفقاً لأعلى معايير الأمن السيبراني العالمية.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation/CTA (Fixed) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant/50 p-margin-mobile z-50 shadow-lg">
        <div className="flex items-center justify-between gap-md">
          <div className="flex flex-col text-right">
            <span className="font-label-sm text-label-sm text-on-surface-variant">الإجمالي</span>
            <span className="font-headline-md text-headline-md text-primary font-bold">{totalPrice.toLocaleString()} SAR</span>
          </div>
          <Link 
            href="/checkout/payment" 
            className="bg-primary text-on-primary flex-1 py-3 rounded-lg font-title-lg text-title-lg flex items-center justify-center gap-xs font-bold active:scale-95 transition-transform"
          >
            <span>ادفع الآن</span>
            <span className="material-symbols-outlined">chevron_left</span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant mt-xl">
        <div className="w-full py-lg px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <div className="flex flex-col items-center md:items-start gap-xs">
            <span className="font-headline-md text-headline-md font-extrabold text-primary">سفريات</span>
            <p className="font-body-md text-body-md text-on-surface-variant text-center md:text-right mt-1">وجهتك الأولى لاستكشاف العالم بكل سهولة، أمن، وراحة تامة.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-md my-sm">
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">عن سفريات</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">سياسة الخصوصية</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">الشروط والأحكام</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">اتصل بنا</Link>
            <Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary hover:underline transition-opacity" href="#">الأسئلة الشائعة</Link>
          </div>
          <p className="font-label-sm text-label-sm text-on-surface-variant">© 2026 سفريات. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
}
