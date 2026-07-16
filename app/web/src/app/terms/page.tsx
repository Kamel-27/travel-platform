import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "الشروط والأحكام | سفريات",
  description: "الشروط والأحكام لاستخدام منصة سفريات لحجز تذاكر الطيران أونلاين.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-xl">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-lg">الشروط والأحكام</h1>
        <div className="space-y-lg text-on-surface-variant font-body-md text-body-md leading-relaxed">
          <section>
            <h2 className="font-title-lg text-title-lg text-on-surface mb-sm">الحجز والأسعار</h2>
            <p>
              تعرض سفريات أسعار الرحلات كما ترد لحظياً من شركات الطيران. السعر النهائي هو المعروض في صفحة
              الدفع قبل إتمام العملية، ولا يُعد الحجز مؤكداً إلا بعد نجاح الدفع واستلامك تأكيد الحجز
              بالبريد الإلكتروني.
            </p>
          </section>
          <section>
            <h2 className="font-title-lg text-title-lg text-on-surface mb-sm">مسؤولية المسافر</h2>
            <p>
              يتحمل المسافر مسؤولية صحة البيانات المدخلة (الاسم كما في جواز السفر، تواريخ السفر)، وصلاحية
              وثائق السفر والتأشيرات المطلوبة لوجهته.
            </p>
          </section>
          <section>
            <h2 className="font-title-lg text-title-lg text-on-surface mb-sm">الإلغاء والاسترداد</h2>
            <p>
              تخضع كل تذكرة لشروط الأجرة الخاصة بها لدى شركة الطيران، وتُعرض شروط الإلغاء قبل إتمام الحجز.
              في حال كان الإلغاء متاحاً يتم تنفيذه من صفحة «رحلاتي» ويُسترد المبلغ بنفس طريقة الدفع.
            </p>
          </section>
          <section>
            <h2 className="font-title-lg text-title-lg text-on-surface mb-sm">حدود المسؤولية</h2>
            <p>
              سفريات وسيط حجز؛ تنفيذ الرحلة (المواعيد، الإلغاءات التشغيلية، الأمتعة) مسؤولية شركة الطيران
              الناقلة وفق شروط النقل الخاصة بها.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
