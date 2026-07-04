"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CheckoutStepper from "@/components/CheckoutStepper";
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

const EMPTY_PASSENGER = (type: PassengerType, withDocument: boolean): PassengerInput => ({
  type,
  title: "mr",
  gender: "m",
  given_name: "",
  family_name: "",
  date_of_birth: "",
  email: "",
  phone_number: "",
  ...(withDocument
    ? { document: { type: "passport", number: "", expiry: "", nationality: "" } }
    : {}),
});

const PASSENGER_TYPE_LABEL: Record<PassengerType, string> = {
  adult: "بالغ",
  child: "طفل",
  infant: "رضيع",
};

const inputCls =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg py-2.5 px-3 font-body-md text-body-md focus:border-primary focus:ring-0 transition-all";

function Field({ label, children, span2 = false }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : "col-span-2 sm:col-span-1"}>
      <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1 px-1">{label}</label>
      {children}
    </div>
  );
}

function SliceDetails({ slice, title }: { slice: NormalizedOffer["slices"][number]; title: string }) {
  const firstSeg = slice.segments[0];
  const lastSeg = slice.segments[slice.segments.length - 1];
  const stops = slice.segments.length - 1;
  return (
    <div className="space-y-sm">
      <div className="flex items-center gap-xs">
        <span className="material-symbols-outlined text-primary !text-[18px]">flight_takeoff</span>
        <span className="font-label-md text-label-md font-bold text-on-surface">{title}</span>
      </div>
      <div className="flex items-center justify-between gap-base bg-surface-container-low rounded-xl p-md">
        <div className="text-center">
          <p className="font-headline-md text-headline-md text-on-surface">{formatFlightTime(firstSeg.departing_at.local)}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{getAirportLabel(slice.origin)}</p>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <span className="font-label-sm text-label-sm text-on-surface-variant">{formatIsoDuration(slice.duration)}</span>
          <div className="w-full flex items-center gap-1 my-1">
            <span className="w-2 h-2 rounded-full border-2 border-primary bg-white shrink-0" />
            <span className="flex-1 h-px bg-outline-variant" />
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {stops === 0 ? "مباشرة" : stops === 1 ? "توقف واحد" : `${stops} توقفات`}
          </span>
        </div>
        <div className="text-center">
          <p className="font-headline-md text-headline-md text-on-surface">{formatFlightTime(lastSeg.arriving_at.local)}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{getAirportLabel(slice.destination)}</p>
        </div>
      </div>
    </div>
  );
}

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
      const withDocs = result.passenger_requirements?.passenger_identity_documents_required ?? false;
      const types = (result.passenger_requirements?.passengers ?? []).map((p) => p.type as PassengerType);
      setPassengers(types.map((t) => EMPTY_PASSENGER(t, withDocs)));
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-base text-center p-4" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-error-container/40 flex items-center justify-center">
          <span className="material-symbols-outlined text-error text-4xl">flight_class</span>
        </div>
        <p className="font-title-lg text-title-lg text-on-surface">{offerError}</p>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          أسعار الرحلات تتغير باستمرار، لذلك تنتهي صلاحية العروض بعد فترة قصيرة. ابحث مجدداً للحصول على أحدث الأسعار.
        </p>
        <Link href="/flights" className="bg-primary text-on-primary px-lg py-3 rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs">
          <span className="material-symbols-outlined !text-[18px]">search</span>
          العودة للبحث
        </Link>
      </div>
    );
  }

  const currentStep = phase === "passengers" ? 2 : 1;

  return (
    <div className="min-h-screen bg-background text-on-surface" dir="rtl">
      <header className="bg-surface-container-lowest shadow-sm border-b border-outline-variant">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary">سفريات</Link>
          <div className="flex items-center gap-xs text-on-surface-variant">
            <span className="material-symbols-outlined !text-[18px] text-primary">verified_user</span>
            <span className="font-label-sm text-label-sm">حجز آمن ومشفر</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-lg">
        <CheckoutStepper current={currentStep} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg items-start">
          <section className="md:col-span-2 space-y-md">
            {(phase === "review" || phase === "creating") && offer && (
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-md md:p-lg space-y-md shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-title-lg text-title-lg font-bold">مراجعة الرحلة</h2>
                  <span className="bg-secondary-container text-on-secondary-container px-sm py-1 rounded-full font-label-sm text-label-sm">
                    {offer.cabin_class === "economy" ? "الدرجة الاقتصادية" : offer.cabin_class.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center gap-sm pb-sm border-b border-outline-variant/60">
                  <div className="w-11 h-11 rounded-full border border-outline-variant bg-white flex items-center justify-center overflow-hidden shrink-0">
                    {offer.airline.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={offer.airline.logo_url} alt={offer.airline.name} className="w-8 h-8 object-contain" />
                    ) : (
                      <span className="material-symbols-outlined text-primary">flight</span>
                    )}
                  </div>
                  <div>
                    <p className="font-title-md text-title-md text-on-surface">{offer.airline.name}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {offer.passengers.length} {offer.passengers.length === 1 ? "مسافر" : "مسافرين"}
                    </p>
                  </div>
                </div>

                {offer.slices.map((slice, i) => (
                  <SliceDetails
                    key={i}
                    slice={slice}
                    title={offer.slices.length > 1 ? (i === 0 ? "رحلة الذهاب" : "رحلة العودة") : "تفاصيل الرحلة"}
                  />
                ))}

                <div className="flex flex-wrap gap-sm pt-sm">
                  <span className={`flex items-center gap-1 px-sm py-1 rounded-full font-label-sm text-label-sm ${offer.conditions.refund_before_departure?.allowed ? "bg-secondary-container/60 text-primary" : "bg-surface-container text-on-surface-variant"}`}>
                    <span className="material-symbols-outlined !text-[16px]">
                      {offer.conditions.refund_before_departure?.allowed ? "check_circle" : "cancel"}
                    </span>
                    {offer.conditions.refund_before_departure?.allowed ? "قابلة للاسترداد قبل المغادرة" : "غير قابلة للاسترداد"}
                  </span>
                  <span className={`flex items-center gap-1 px-sm py-1 rounded-full font-label-sm text-label-sm ${offer.conditions.change_before_departure?.allowed ? "bg-secondary-container/60 text-primary" : "bg-surface-container text-on-surface-variant"}`}>
                    <span className="material-symbols-outlined !text-[16px]">
                      {offer.conditions.change_before_departure?.allowed ? "check_circle" : "cancel"}
                    </span>
                    {offer.conditions.change_before_departure?.allowed ? "قابلة للتعديل قبل المغادرة" : "غير قابلة للتعديل"}
                  </span>
                </div>

                {submitError && (
                  <div className="bg-error-container/20 border border-error rounded-xl p-sm flex items-center gap-sm">
                    <span className="material-symbols-outlined text-error !text-[20px]">error</span>
                    <p className="font-label-md text-label-md text-error">{submitError}</p>
                  </div>
                )}

                {isAuthenticated ? (
                  <button
                    onClick={handleCreateBooking}
                    disabled={phase === "creating"}
                    className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-label-md text-label-md font-bold disabled:opacity-60 hover:bg-primary-container transition-all flex items-center justify-center gap-xs cursor-pointer"
                  >
                    {phase === "creating" ? (
                      <>
                        <span className="material-symbols-outlined animate-spin !text-[20px]">progress_activity</span>
                        جارِ إنشاء الحجز...
                      </>
                    ) : (
                      <>
                        متابعة الحجز
                        <span className="material-symbols-outlined !text-[20px]">arrow_back</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleSignInToContinue}
                    className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-label-md text-label-md font-bold hover:bg-primary-container transition-all flex items-center justify-center gap-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined !text-[20px]">login</span>
                    سجّل الدخول للمتابعة
                  </button>
                )}
              </div>
            )}

            {phase === "passengers" && booking && (
              <form onSubmit={handleSubmitPassengers} className="space-y-md">
                <div className="bg-secondary-container/40 border border-primary/20 rounded-xl p-sm flex items-start gap-sm">
                  <span className="material-symbols-outlined text-primary !text-[20px] mt-0.5">badge</span>
                  <p className="font-label-md text-label-md text-on-surface-variant">
                    أدخل بيانات كل مسافر تماماً كما هي مدوّنة في {requiresDocuments ? "جواز السفر" : "وثيقة الهوية"} — أي اختلاف قد يمنع إصدار التذكرة.
                  </p>
                </div>

                {submitError && (
                  <div className="bg-error-container/20 border border-error rounded-xl p-sm flex items-center gap-sm">
                    <span className="material-symbols-outlined text-error !text-[20px]">error</span>
                    <p className="font-label-md text-label-md text-error">{submitError}</p>
                  </div>
                )}

                {passengers.map((passenger, index) => (
                  <div key={index} className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
                    <div className="bg-surface-container-low px-md py-sm flex items-center gap-sm border-b border-outline-variant/60">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined !text-[20px]">
                          {passenger.type === "infant" ? "child_care" : passenger.type === "child" ? "boy" : "person"}
                        </span>
                      </div>
                      <h3 className="font-title-md text-title-md">
                        المسافر {index + 1}
                        <span className="font-label-sm text-label-sm text-on-surface-variant mr-2">
                          ({PASSENGER_TYPE_LABEL[passenger.type]})
                        </span>
                      </h3>
                    </div>

                    <div className="p-md space-y-md">
                      <div className="grid grid-cols-2 gap-sm">
                        <Field label="اللقب">
                          <select
                            value={passenger.title}
                            onChange={(e) => updatePassenger(index, { title: e.target.value as PassengerInput["title"] })}
                            className={inputCls}
                          >
                            <option value="mr">السيد</option>
                            <option value="mrs">السيدة</option>
                            <option value="ms">الآنسة</option>
                            <option value="miss">آنسة</option>
                          </select>
                        </Field>
                        <Field label="الجنس">
                          <select
                            value={passenger.gender}
                            onChange={(e) => updatePassenger(index, { gender: e.target.value as PassengerInput["gender"] })}
                            className={inputCls}
                          >
                            <option value="m">ذكر</option>
                            <option value="f">أنثى</option>
                          </select>
                        </Field>
                        <Field label="الاسم الأول (بالإنجليزية)">
                          <input
                            required
                            dir="ltr"
                            placeholder="Ahmed"
                            value={passenger.given_name}
                            onChange={(e) => updatePassenger(index, { given_name: e.target.value })}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="اسم العائلة (بالإنجليزية)">
                          <input
                            required
                            dir="ltr"
                            placeholder="Mohamed"
                            value={passenger.family_name}
                            onChange={(e) => updatePassenger(index, { family_name: e.target.value })}
                            className={inputCls}
                          />
                        </Field>
                        <Field label="تاريخ الميلاد">
                          <input
                            required
                            type="date"
                            value={passenger.date_of_birth}
                            onChange={(e) => updatePassenger(index, { date_of_birth: e.target.value })}
                            className={inputCls}
                          />
                        </Field>
                        {passenger.type === "infant" && (
                          <Field label="البالغ المسؤول">
                            <select
                              required
                              value={passenger.responsible_adult_index ?? ""}
                              onChange={(e) => updatePassenger(index, { responsible_adult_index: Number(e.target.value) })}
                              className={inputCls}
                            >
                              <option value="" disabled>اختر البالغ المسؤول</option>
                              {adultIndices.map(({ i }) => (
                                <option key={i} value={i}>المسافر {i + 1}</option>
                              ))}
                            </select>
                          </Field>
                        )}
                      </div>

                      <div>
                        <p className="font-label-md text-label-md font-bold text-on-surface-variant mb-sm flex items-center gap-xs">
                          <span className="material-symbols-outlined !text-[18px] text-primary">contact_mail</span>
                          بيانات التواصل
                        </p>
                        <div className="grid grid-cols-2 gap-sm">
                          <Field label="البريد الإلكتروني">
                            <input
                              required
                              type="email"
                              dir="ltr"
                              placeholder="email@example.com"
                              value={passenger.email}
                              onChange={(e) => updatePassenger(index, { email: e.target.value })}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="رقم الجوال (بالرمز الدولي)">
                            <input
                              required
                              type="tel"
                              dir="ltr"
                              placeholder="+9665XXXXXXXX"
                              value={passenger.phone_number}
                              onChange={(e) => updatePassenger(index, { phone_number: e.target.value })}
                              className={inputCls}
                            />
                          </Field>
                        </div>
                      </div>

                      {requiresDocuments && (
                        <div>
                          <p className="font-label-md text-label-md font-bold text-on-surface-variant mb-sm flex items-center gap-xs">
                            <span className="material-symbols-outlined !text-[18px] text-primary">travel</span>
                            وثيقة السفر
                          </p>
                          <div className="grid grid-cols-2 gap-sm">
                            <Field label="نوع الوثيقة">
                              <select
                                required
                                value={passenger.document?.type ?? "passport"}
                                onChange={(e) => updatePassenger(index, { document: { ...passenger.document, type: e.target.value } as PassengerInput["document"] })}
                                className={inputCls}
                              >
                                <option value="passport">جواز سفر</option>
                              </select>
                            </Field>
                            <Field label="رقم جواز السفر">
                              <input
                                required
                                dir="ltr"
                                placeholder="A12345678"
                                value={passenger.document?.number ?? ""}
                                onChange={(e) => updatePassenger(index, { document: { ...passenger.document, number: e.target.value } as PassengerInput["document"] })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="تاريخ انتهاء الجواز">
                              <input
                                required
                                type="date"
                                value={passenger.document?.expiry ?? ""}
                                onChange={(e) => updatePassenger(index, { document: { ...passenger.document, expiry: e.target.value } as PassengerInput["document"] })}
                                className={inputCls}
                              />
                            </Field>
                            <Field label="الجنسية (رمز الدولة)">
                              <input
                                required
                                dir="ltr"
                                placeholder="EG"
                                maxLength={2}
                                value={passenger.document?.nationality ?? ""}
                                onChange={(e) => updatePassenger(index, { document: { ...passenger.document, nationality: e.target.value.toUpperCase() } as PassengerInput["document"] })}
                                className={inputCls}
                              />
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={isSubmittingPassengers}
                  className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-label-md text-label-md font-bold disabled:opacity-60 hover:bg-primary-container transition-all flex items-center justify-center gap-xs cursor-pointer"
                >
                  {isSubmittingPassengers ? (
                    <>
                      <span className="material-symbols-outlined animate-spin !text-[20px]">progress_activity</span>
                      جارِ الحفظ...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined !text-[20px]">lock</span>
                      المتابعة للدفع الآمن
                    </>
                  )}
                </button>
              </form>
            )}
          </section>

          {offer && (
            <aside className="md:col-span-1">
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-md space-y-sm sticky top-4 shadow-sm">
                <h3 className="font-title-md text-title-md font-bold border-b border-outline-variant pb-sm">ملخص الحجز</h3>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-primary !text-[18px]">flight</span>
                  <span className="font-label-md text-label-md text-on-surface">{offer.airline.name}</span>
                </div>
                {offer.slices.map((slice, i) => (
                  <div key={i} className="text-label-sm font-label-sm text-on-surface-variant border-t border-outline-variant/50 pt-sm first:border-t-0 first:pt-0 space-y-0.5">
                    <p className="font-bold text-on-surface">{getAirportLabel(slice.origin)} ← {getAirportLabel(slice.destination)}</p>
                    <p>{formatFlightTime(slice.segments[0].departing_at.local)} · {formatIsoDuration(slice.duration)}</p>
                  </div>
                ))}
                <div className="border-t border-outline-variant pt-sm space-y-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-label-md text-label-md">الإجمالي</span>
                    <span className="font-headline-md text-headline-md text-primary font-bold">
                      {formatMoney(offer.total.amount, offer.total.currency)}
                    </span>
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">شامل جميع الضرائب والرسوم</p>
                </div>
              </div>
            </aside>
          )}
        </div>
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
