"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

/**
 * Route-segment error boundary. Wraps every page and nested layout below the
 * root layout, so an unhandled render/data error shows this instead of the
 * framework's default crash screen (which is English, LTR, and unbranded).
 *
 * Errors thrown in the root layout itself bubble past this — `global-error.tsx`
 * catches those.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div
      className="min-h-screen bg-surface-container-low text-on-surface font-sans flex flex-col"
      dir="rtl"
    >
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center px-margin-mobile md:px-margin-desktop py-xl">
        <div className="max-w-lg w-full text-center flex flex-col items-center gap-md">
          <span className="material-symbols-outlined text-error text-6xl">
            error
          </span>

          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            حدث خطأ غير متوقع
          </h1>

          <p className="font-body-lg text-body-lg text-on-surface-variant/80">
            نعتذر عن هذا العطل. لم يتأثر أي من حجوزاتك أو مدفوعاتك، ويمكنك
            المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-sm mt-base">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors"
            >
              إعادة المحاولة
            </button>
            <Link
              href="/"
              className="border border-outline text-on-surface px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container transition-colors"
            >
              العودة للرئيسية
            </Link>
            <Link
              href="/support"
              className="text-primary px-lg py-sm font-label-md text-label-md hover:underline"
            >
              تواصل مع الدعم
            </Link>
          </div>

          {/* Support reference: matches this crash to the server-side logs. */}
          {error.digest ? (
            <p className="font-label-sm text-label-sm text-on-surface-variant/60 mt-md">
              رقم مرجعي للدعم: <span dir="ltr">{error.digest}</span>
            </p>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
