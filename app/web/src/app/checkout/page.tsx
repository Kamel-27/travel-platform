"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { setReturnPath } from "@/lib/return-path";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatIsoDuration } from "@/lib/datetime";
import { getAirportLabel } from "@/lib/airports";
import type { Booking, NormalizedOffer, PassengerInput, PassengerType } from "@/lib/types";

type Phase = "loading" | "offer_error" | "review" | "creating" | "passengers";

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 410) return "انتهت صلاحية هذا العرض، يرجى البحث عن رحلة جديدة";
    if (err.status === 503) return "الخدمة غير متاحة حالياً، يرجى المحاولة لاحقاً";
    return err.message;
  }
  return "حدث خطأ غير متوقع";
}

const EMPTY_PASSENGER = (type: PassengerType): PassengerInput => ({
  type,
  title: "mr",
  gender: "m",
  given_name: "",
  family_name: "",
  date_of_birth: "",
  email: "",
  phone_number: "",
});

function CheckoutInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const offerId = searchParams.get("offer_id");
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const [phase, setPhase] = useState<Phase>(offerId ? "loading" : "offer_error");
  const [offer, setOffer] = useState<NormalizedOffer | null>(null);
  const [offerError, setOfferError] = useState<string | null>(
    offerId ? null : "لم يتم تحديد رحلة للحجز",
  );
  const [booking, setBooking] = useState<Booking | null>(null);
  const [passengers, setPassengers] = useState<PassengerInput[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingPassengers, setIsSubmittingPassengers] = useState(false);
  const requiresDocuments = booking?.passenger_requirements?.passenger_identity_documents_required ?? false;

  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const result = await api.get<{ data: NormalizedOffer }>(
          `/flights/offers/${encodeURIComponent(offerId)}`,
          { skipAuth: true, skipAuthRetry: true },
        );
        if (cancelled) return;
        setOffer(result.data);
        setPhase("review");
      } catch (err) {
        if (cancelled) return;
        setOfferError(errorMessage(err));
        setPhase("offer_error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  const handleSignInToContinue = () => {
    setReturnPath(`/checkout?offer_id=${encodeURIComponent(offerId ?? "")}`);
    router.push("/signin");
  };

  const handleCreateBooking = useCallback(async () => {
    if (!offerId) return;
    setPhase("creating");
    setSubmitError(null);
    try {
      const result = await api.post<Booking>(
        "/bookings",
        { offer_id: offerId },
        { headers: { "Idempotency-Key": idempotencyKeyRef.current } },
      );
      setBooking(result);
      const types = (result.passenger_requirements?.passengers ?? []).map((p) => p.type as PassengerType);
      setPassengers(types.map((t) => EMPTY_PASSENGER(t)));
      setPhase("passengers");
    } catch (err) {
      setSubmitError(errorMessage(err));
      setPhase(err instanceof ApiError && err.status === 410 ? "offer_error" : "review");
    }
  }, [offerId]);

  const updatePassenger = (index: number, patch: Partial<PassengerInput>) => {
    setPassengers((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const adultIndices = useMemo(
    () => passengers.map((p, i) => ({ p, i })).filter(({ p }) => p.type === "adult"),
    [passengers],
  );

  const handleSubmitPassengers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setIsSubmittingPassengers(true);
    setSubmitError(null);
    try {
      await api.put(`/bookings/${booking.id}/passengers`, { passengers });
      router.push(`/checkout/payment?booking_id=${booking.id}`);
    } catch (err) {
      setSubmitError(errorMessage(err));
      setIsSubmittingPassengers(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
      </div>
    );
  }

  if (phase === "offer_error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-base text-center p-4">
        <span className="material-symbols-outlined text-error text-5xl">error</span>
        <p className="font-title-md text-title-md text-on-surface">{offerError}</p>
        <Link href="/flights" className="bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md">
          العودة للبحث
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface" dir="rtl">
      <header className="bg-surface-container-lowest shadow-sm border-b border-outline-variant">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary">سفريات</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-lg grid grid-cols-1 md:grid-cols-3 gap-lg">
        <section className="md:col-span-2 space-y-md">
          {(phase === "review" || phase === "creating") && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md space-y-base">
              <h2 className="font-title-lg text-title-lg">مراجعة الحجز</h2>
              {submitError && <p className="font-label-sm text-label-sm text-error">{submitError}</p>}
              {isAuthenticated ? (
                <button
                  onClick={handleCreateBooking}
                  disabled={phase === "creating"}
                  className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-label-md disabled:opacity-60"
                >
                  {phase === "creating" ? "جارِ إنشاء الحجز..." : "متابعة الحجز"}
                </button>
              ) : (
                <button
                  onClick={handleSignInToContinue}
                  className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-label-md"
                >
                  سجّل الدخول للمتابعة
                </button>
              )}
            </div>
          )}

          {phase === "passengers" && booking && (
            <form onSubmit={handleSubmitPassengers} className="space-y-md">
              {submitError && (
                <div className="bg-error-container/20 border border-error rounded-xl p-md">
                  <p className="font-label-sm text-label-sm text-error">{submitError}</p>
                </div>
              )}
              {passengers.map((passenger, index) => (
                <div key={index} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md space-y-sm">
                  <h3 className="font-title-md text-title-md">
                    المسافر {index + 1} ({passenger.type === "adult" ? "بالغ" : passenger.type === "child" ? "طفل" : "رضيع"})
                  </h3>
                  <div className="grid grid-cols-2 gap-sm">
                    <select
                      value={passenger.title}
                      onChange={(e) => updatePassenger(index, { title: e.target.value as PassengerInput["title"] })}
                      className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                    >
                      <option value="mr">السيد</option>
                      <option value="mrs">السيدة</option>
                      <option value="ms">الآنسة</option>
                      <option value="miss">آنسة</option>
                    </select>
                    <select
                      value={passenger.gender}
                      onChange={(e) => updatePassenger(index, { gender: e.target.value as PassengerInput["gender"] })}
                      className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                    >
                      <option value="m">ذكر</option>
                      <option value="f">أنثى</option>
                    </select>
                    <input
                      required
                      placeholder="الاسم الأول"
                      value={passenger.given_name}
                      onChange={(e) => updatePassenger(index, { given_name: e.target.value })}
                      className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                    />
                    <input
                      required
                      placeholder="اسم العائلة"
                      value={passenger.family_name}
                      onChange={(e) => updatePassenger(index, { family_name: e.target.value })}
                      className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                    />
                    <input
                      required
                      type="date"
                      value={passenger.date_of_birth}
                      onChange={(e) => updatePassenger(index, { date_of_birth: e.target.value })}
                      className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                    />
                    <input
                      required
                      type="email"
                      dir="ltr"
                      placeholder="email@example.com"
                      value={passenger.email}
                      onChange={(e) => updatePassenger(index, { email: e.target.value })}
                      className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                    />
                    <input
                      required
                      type="tel"
                      dir="ltr"
                      placeholder="+9665XXXXXXXX"
                      value={passenger.phone_number}
                      onChange={(e) => updatePassenger(index, { phone_number: e.target.value })}
                      className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 col-span-2"
                    />
                    {passenger.type === "infant" && (
                      <select
                        required
                        value={passenger.responsible_adult_index ?? ""}
                        onChange={(e) => updatePassenger(index, { responsible_adult_index: Number(e.target.value) })}
                        className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 col-span-2"
                      >
                        <option value="" disabled>البالغ المسؤول</option>
                        {adultIndices.map(({ i }) => (
                          <option key={i} value={i}>المسافر {i + 1}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {requiresDocuments && (
                    <div className="grid grid-cols-2 gap-sm pt-sm border-t border-outline-variant/50">
                      <input
                        required
                        placeholder="نوع الوثيقة (passport)"
                        value={passenger.document?.type ?? ""}
                        onChange={(e) => updatePassenger(index, { document: { ...passenger.document, type: e.target.value } as PassengerInput["document"] })}
                        className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                      />
                      <input
                        required
                        placeholder="رقم جواز السفر"
                        value={passenger.document?.number ?? ""}
                        onChange={(e) => updatePassenger(index, { document: { ...passenger.document, number: e.target.value } as PassengerInput["document"] })}
                        className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                      />
                      <input
                        required
                        type="date"
                        placeholder="تاريخ الانتهاء"
                        value={passenger.document?.expiry ?? ""}
                        onChange={(e) => updatePassenger(index, { document: { ...passenger.document, expiry: e.target.value } as PassengerInput["document"] })}
                        className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                      />
                      <input
                        required
                        placeholder="الجنسية (رمز الدولة، مثال EG)"
                        maxLength={2}
                        value={passenger.document?.nationality ?? ""}
                        onChange={(e) => updatePassenger(index, { document: { ...passenger.document, nationality: e.target.value.toUpperCase() } as PassengerInput["document"] })}
                        className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3"
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={isSubmittingPassengers}
                className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-label-md disabled:opacity-60"
              >
                {isSubmittingPassengers ? "جارِ الحفظ..." : "المتابعة للدفع"}
              </button>
            </form>
          )}
        </section>

        {offer && (
          <aside className="md:col-span-1">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md space-y-sm sticky top-4">
              <h3 className="font-title-md text-title-md">{offer.airline.name}</h3>
              {offer.slices.map((slice, i) => (
                <div key={i} className="text-label-sm font-label-sm text-on-surface-variant border-t border-outline-variant/50 pt-sm first:border-t-0 first:pt-0">
                  <p>{getAirportLabel(slice.origin)} → {getAirportLabel(slice.destination)}</p>
                  <p>{formatFlightTime(slice.segments[0].departing_at.local)} · {formatIsoDuration(slice.duration)}</p>
                </div>
              ))}
              <div className="border-t border-outline-variant pt-sm flex justify-between items-center">
                <span className="font-label-md text-label-md">الإجمالي</span>
                <span className="font-headline-md text-headline-md text-primary">
                  {formatMoney(offer.total.amount, offer.total.currency)}
                </span>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
