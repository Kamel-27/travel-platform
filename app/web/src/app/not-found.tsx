import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة",
  robots: { index: false, follow: true },
};

/**
 * 404 page for unmatched routes and for segments that call `notFound()`.
 */
export default function NotFound() {
  return (
    <div
      className="min-h-screen bg-surface-container-low text-on-surface font-sans flex flex-col"
      dir="rtl"
    >
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center px-margin-mobile md:px-margin-desktop py-xl">
        <div className="max-w-lg w-full text-center flex flex-col items-center gap-md">
          <span className="material-symbols-outlined text-primary text-6xl">
            travel_explore
          </span>

          <p className="font-display-lg text-display-lg text-primary" dir="ltr">
            404
          </p>

          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            لم نتمكن من العثور على هذه الصفحة
          </h1>

          <p className="font-body-lg text-body-lg text-on-surface-variant/80">
            ربما تم نقل الرابط أو حذفه، أو أنه غير صحيح. يمكنك البدء من البحث عن
            رحلتك القادمة أو مراجعة حجوزاتك.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-sm mt-base">
            <Link
              href="/"
              className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors"
            >
              ابحث عن رحلة
            </Link>
            <Link
              href="/user-dashboard"
              className="border border-outline text-on-surface px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container transition-colors"
            >
              رحلاتي
            </Link>
            <Link
              href="/support"
              className="text-primary px-lg py-sm font-label-md text-label-md hover:underline"
            >
              تواصل مع الدعم
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
