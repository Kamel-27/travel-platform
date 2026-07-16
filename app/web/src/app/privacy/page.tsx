import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "سياسة الخصوصية | سفريات",
  description: "سياسة الخصوصية لمنصة سفريات لحجز تذاكر الطيران أونلاين.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-xl">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-lg">سياسة الخصوصية</h1>
        <div className="space-y-lg text-on-surface-variant font-body-md text-body-md leading-relaxed">
          <section>
            <h2 className="font-title-lg text-title-lg text-on-surface mb-sm">البيانات التي نجمعها</h2>
            <p>
              نجمع البيانات اللازمة لإتمام حجزك فقط: الاسم كما هو في جواز السفر، تاريخ الميلاد، بيانات التواصل
              (البريد الإلكتروني ورقم الهاتف)، وتفاصيل الرحلة المطلوبة. عند إنشاء حساب نحتفظ ببريدك الإلكتروني
              وبيانات تسجيل الدخول.
            </p>
          </section>
          <section>
            <h2 className="font-title-lg text-title-lg text-on-surface mb-sm">كيف نستخدم بياناتك</h2>
            <p>
              تُستخدم بياناتك لإصدار التذاكر لدى شركات الطيران، وإرسال تأكيد الحجز والتذكرة الإلكترونية،
              والتواصل معك بشأن أي تغييرات على رحلتك. لا نبيع بياناتك الشخصية لأي طرف ثالث.
            </p>
          </section>
          <section>
            <h2 className="font-title-lg text-title-lg text-on-surface mb-sm">بيانات الدفع</h2>
            <p>
              تتم جميع عمليات الدفع عبر بوابة دفع معتمدة ومشفرة. لا نخزّن بيانات بطاقتك البنكية على خوادمنا
              في أي وقت.
            </p>
          </section>
          <section>
            <h2 className="font-title-lg text-title-lg text-on-surface mb-sm">حقوقك</h2>
            <p>
              يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذف حسابك في أي وقت عبر التواصل مع فريق الدعم من
              صفحة الدعم.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
