"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

/**
 * Checkout-specific error boundary (covers /checkout and everything nested:
 * payment, payment-return, confirmation).
 *
 * Deliberately different from the generic boundary: a crash here may land
 * *after* Paymob has authorised the card but before we've rendered the result,
 * so the primary action is "go check your bookings", not "try again". Telling
 * someone to retry a payment they may already have made is how you get a
 * duplicate charge — or a support ticket claiming one.
 */
export default function CheckoutError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { flow: "checkout" } });
  }, [error]);

  return (
    <div
      className="min-h-screen bg-surface-container-low text-on-surface font-sans flex flex-col"
      dir="rtl"
    >
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center px-margin-mobile md:px-margin-desktop py-xl">
        <div className="max-w-xl w-full text-center flex flex-col items-center gap-md">
          <span className="material-symbols-outlined text-error text-6xl">
            error
          </span>

          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            تعذر إكمال هذه الخطوة
          </h1>

          <p className="font-body-lg text-body-lg text-on-surface-variant/80">
            حدث عطل أثناء معالجة طلبك. من فضلك{" "}
            <strong className="text-on-surface">لا تُعِد عملية الدفع</strong>{" "}
            قبل مراجعة صفحة «رحلاتي» — إذا تم خصم المبلغ فسيظهر الحجز هناك خلال
            دقائق، ولن يتم خصم أي مبلغ مرتين.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-sm mt-base">
            <Link
              href="/user-dashboard"
              className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors"
            >
              مراجعة رحلاتي
            </Link>
            <Link
              href="/support"
              className="border border-outline text-on-surface px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container transition-colors"
            >
              تواصل مع الدعم
            </Link>
          </div>

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
