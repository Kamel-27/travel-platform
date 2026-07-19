"use client";

import { useEffect } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Target of Paymob's "Transaction response callback" — Paymob navigates the
 * iframe's own browsing context here after payment, which would otherwise
 * strand the user on Paymob's generic branded page instead of our app. This
 * page immediately breaks out of the iframe (window.top) back to our own
 * payment page, which resumes polling and redirects to /checkout/confirmation
 * once the booking is actually confirmed.
 */
function PaymentReturnInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Paymob's merchant_order_id is `${bookingId}:${suffix}` (see
    // payments.service.ts) — the booking id is always the part before the colon.
    const merchantOrderId = searchParams.get("merchant_order_id");
    const bookingId = merchantOrderId?.split(":")[0] ?? null;

    const destination = bookingId
      ? `/checkout/payment?booking_id=${bookingId}`
      : "/user-dashboard";

    if (window.top) {
      window.top.location.href = destination;
    } else {
      window.location.href = destination;
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center gap-md" dir="rtl">
      <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
      <p className="font-title-md">جاري العودة إلى سفريات...</p>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        </div>
      }
    >
      <PaymentReturnInner />
    </Suspense>
  );
}
