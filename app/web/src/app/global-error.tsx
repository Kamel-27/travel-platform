"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";
import { materialSymbols, sansArabic } from "./fonts";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, which
 * `error.tsx` cannot reach. This file *replaces* the root layout when active,
 * so it has to bring its own <html>/<body>, fonts, and global styles — and it
 * cannot use anything that depends on AuthProvider (SiteHeader/SiteFooter).
 *
 * Metadata exports aren't supported in a client component, so the tab title is
 * set with React's <title>.
 */
export default function GlobalError({
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
    <html
      lang="ar"
      dir="rtl"
      className={`${sansArabic.variable} ${materialSymbols.variable}`}
    >
      <body className="safariyat min-h-screen bg-surface-container-low text-on-surface font-sans flex items-center justify-center">
        <title>حدث خطأ | سفريات Safariyat</title>

        <main className="px-margin-mobile md:px-margin-desktop py-xl">
          <div className="max-w-lg w-full text-center flex flex-col items-center gap-md mx-auto">
            <span className="material-symbols-outlined text-error text-6xl">
              error
            </span>

            <h1 className="font-headline-lg text-headline-lg text-on-surface">
              حدث خطأ غير متوقع
            </h1>

            <p className="font-body-lg text-body-lg text-on-surface-variant/80">
              نعتذر عن هذا العطل. لم يتأثر أي من حجوزاتك أو مدفوعاتك. يرجى إعادة
              المحاولة، وإذا استمرت المشكلة تواصل مع فريق الدعم.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-sm mt-base">
              <button
                type="button"
                onClick={() => unstable_retry()}
                className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors"
              >
                إعادة المحاولة
              </button>
              {/*
                Deliberate full page load, not next/link: this boundary only
                renders when the root layout itself failed, so a soft client
                navigation would re-enter the same broken tree. A hard reload
                is the recovery path.
              */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="border border-outline text-on-surface px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container transition-colors"
              >
                العودة للرئيسية
              </a>
            </div>

            {error.digest ? (
              <p className="font-label-sm text-label-sm text-on-surface-variant/60 mt-md">
                رقم مرجعي للدعم: <span dir="ltr">{error.digest}</span>
              </p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
