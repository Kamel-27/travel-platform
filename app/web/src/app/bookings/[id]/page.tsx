"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CancelBookingModal from "@/components/CancelBookingModal";
import { api, apiFetchBlob, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatFlightTime, formatFlightDate, formatIsoDuration, formatSystemTimestamp } from "@/lib/datetime";
import { getAirportLabel } from "@/lib/airports";
import type { Booking, BookingDocument, BookingStatus } from "@/lib/types";

const STATUS_LABELS: Partial<Record<BookingStatus, { label: string; classes: string; icon: string }>> = {
  confirmed: { label: "مؤكد", classes: "bg-green-500/10 border-green-500/30 text-green-600", icon: "check_circle" },
  awaiting_payment: { label: "بانتظار الدفع", classes: "bg-orange-500/10 border-orange-500/30 text-orange-600", icon: "hourglass_empty" },
  paid: { label: "مدفوع (قيد التأكيد)", classes: "bg-teal-500/10 border-teal-500/30 text-teal-600", icon: "progress_activity" },
  cancelled: { label: "ملغى", classes: "bg-surface-container-high border-outline-variant text-on-surface-variant", icon: "cancel" },
  refunded: { label: "مسترد", classes: "bg-teal-500/10 border-teal-500/30 text-teal-600", icon: "currency_exchange" },
  failed: { label: "فشل", classes: "bg-error-container/20 border-error text-error", icon: "error" },
  order_failed: { label: "فشل إصدار الحجز", classes: "bg-error-container/20 border-error text-error", icon: "error" },
  pending: { label: "قيد الإنشاء", classes: "bg-surface-container-high border-outline-variant text-on-surface-variant", icon: "pending" },
};

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const { isAuthenticated, isLoading } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !bookingId) return;

    let isMounted = true;

    async function load() {
      try {
        const data = await api.get<Booking>(`/bookings/${bookingId}`);
        if (!isMounted) return;
        setBooking(data);
        setError(null);

        // Ticket numbers only exist once the airline order is confirmed.
        if (data.status === "confirmed") {
          try {
            const docs = await api.get<{ data: BookingDocument[] }>(`/bookings/${bookingId}/documents`);
            if (isMounted) setDocuments(docs.data);
          } catch {
            // Non-fatal — the page still renders without ticket numbers.
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setError(err.message || "فشل تحميل تفاصيل الحجز.");
        } else {
          setError("حدث خطأ غير متوقع أثناء تحميل تفاصيل الحجز.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, bookingId]);

  const reloadBooking = async () => {
    try {
      const data = await api.get<Booking>(`/bookings/${bookingId}`);
      setBooking(data);
    } catch {
      // Keep showing the last known state.
    }
  };

  const handleDownloadTicket = async () => {
    if (!bookingId || downloadingPdf) return;
    setDownloadingPdf(true);
    setPdfError(null);
    try {
      const blob = await apiFetchBlob(`/bookings/${bookingId}/ticket.pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ticket-${booking?.booking_reference || bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setPdfError(err instanceof ApiError ? err.message : "تعذّر تحميل التذكرة، يرجى المحاولة لاحقاً.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading || (isAuthenticated && loading)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-md" dir="rtl">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="font-title-md">جاري تحميل تفاصيل الحجز...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-outline text-5xl">lock</span>
        <p className="font-title-md">يرجى تسجيل الدخول لعرض تفاصيل هذا الحجز.</p>
        <Link href={`/signin?next=/bookings/${bookingId}`} className="mt-md bg-primary text-on-primary px-lg py-md rounded-xl font-bold font-title-lg shadow-md hover:opacity-90 active:scale-95 transition-all">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-base text-center p-4" dir="rtl">
        <span className="material-symbols-outlined text-error text-5xl">error</span>
        <p className="font-title-md max-w-md">{error || "تعذر العثور على هذا الحجز."}</p>
        <Link href="/user-dashboard" className="mt-md bg-primary text-on-primary px-md py-sm rounded-lg font-label-md text-label-md">
          العودة إلى حجوزاتي
        </Link>
      </div>
    );
  }

  const status = STATUS_LABELS[booking.status];

  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface font-sans" dir="rtl">
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-lg">
        {/* Breadcrumb + status */}
        <div className="flex flex-wrap items-center justify-between gap-base mb-lg">
          <div>
            <Link href="/user-dashboard" className="flex items-center gap-xs text-on-surface-variant hover:text-primary font-label-md text-label-md transition-colors">
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              <span>العودة إلى حجوزاتي</span>
            </Link>
            <h1 className="font-headline-lg text-headline-lg text-primary font-bold mt-xs">تفاصيل الحجز</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              رقم مرجع الحجز (PNR):{" "}
              <span className="font-mono font-bold text-on-surface select-all">
                {booking.booking_reference ? `#${booking.booking_reference}` : "لم يصدر بعد"}
              </span>
            </p>
          </div>
          {status && (
            <span className={`border font-label-md text-label-md px-md py-xs rounded-full flex items-center gap-xs ${status.classes}`}>
              <span className="material-symbols-outlined text-[16px]">{status.icon}</span>
              <span>{status.label}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-md items-start">
          {/* Itinerary + passengers */}
          <div className="lg:col-span-2 space-y-md">
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="p-md border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
                <h2 className="font-title-lg text-title-lg font-bold flex items-center gap-base">
                  <span className="material-symbols-outlined text-primary">flight_takeoff</span>
                  مسار الرحلة
                </h2>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  {booking.snapshot?.owner_airline_name}
                </span>
              </div>

              <div className="p-md space-y-md">
                {booking.snapshot?.slices.map((slice, sliceIndex) => (
                  <div key={slice.id} className="p-md bg-surface-bright rounded-xl border border-outline-variant space-y-md">
                    <div className="flex items-center justify-between border-b border-outline-variant/30 pb-xs">
                      <p className="font-label-md text-label-md text-on-surface font-bold">
                        {getAirportLabel(slice.origin)} ← {getAirportLabel(slice.destination)}
                      </p>
                      <div className="flex items-center gap-xs">
                        <span className="text-xs text-on-surface-variant">
                          {formatIsoDuration(slice.duration)} · {slice.segments.length === 1 ? "مباشر" : `${slice.segments.length - 1} توقف`}
                        </span>
                        <span className="text-xs bg-primary/10 text-primary px-sm py-[2px] rounded-full font-bold">
                          {sliceIndex === 0 ? "ذهاب" : "عودة"}
                        </span>
                      </div>
                    </div>

                    {slice.segments.map((segment) => (
                      <div key={segment.id} className="flex flex-col md:flex-row md:items-center justify-between gap-sm">
                        <div className="shrink-0">
                          <p className="font-label-sm text-label-sm text-on-surface-variant">رقم الرحلة</p>
                          <p className="font-title-md text-title-md font-bold text-on-surface">
                            {segment.marketing_carrier} {segment.flight_number}
                          </p>
                        </div>
                        <div className="flex items-center gap-md flex-1 md:justify-center">
                          <div className="text-right">
                            <p className="font-title-lg text-title-lg font-bold text-on-surface">{formatFlightTime(segment.departing_at.local)}</p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">
                              {formatFlightDate(segment.departing_at.local)}
                              {segment.origin_terminal ? ` · صالة ${segment.origin_terminal}` : ""}
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-primary rotate-180">arrow_right_alt</span>
                          <div className="text-right">
                            <p className="font-title-lg text-title-lg font-bold text-on-surface">{formatFlightTime(segment.arriving_at.local)}</p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">
                              {formatFlightDate(segment.arriving_at.local)}
                              {segment.destination_terminal ? ` · صالة ${segment.destination_terminal}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {!booking.snapshot && (
                  <p className="text-on-surface-variant font-body-md">لا تتوفر تفاصيل مسار لهذا الحجز.</p>
                )}
              </div>
            </section>

            {/* Passengers */}
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="p-md border-b border-outline-variant bg-surface-container-low">
                <h2 className="font-title-lg text-title-lg font-bold flex items-center gap-base">
                  <span className="material-symbols-outlined text-primary">people</span>
                  المسافرون
                </h2>
              </div>
              <div className="p-md grid grid-cols-1 md:grid-cols-2 gap-sm">
                {booking.passengers.map((p, index) => (
                  <div key={p.id} className="flex items-start gap-md p-md rounded-xl border border-outline-variant bg-surface-container-low">
                    <span className="material-symbols-outlined text-primary text-2xl">person</span>
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">المسافر {index + 1}</p>
                      <p className="font-body-lg text-body-lg font-bold text-on-surface">
                        {p.title === "mr" ? "السيد" : p.title === "mrs" ? "السيدة" : p.title === "ms" ? "الآنسة" : "المسافر"}{" "}
                        {p.given_name} {p.family_name}
                      </p>
                      <p className="text-xs text-on-surface-variant/70">{p.email || "بدون بريد إلكتروني"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ticket numbers */}
            {documents.length > 0 && (
              <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="p-md border-b border-outline-variant bg-surface-container-low">
                  <h2 className="font-title-lg text-title-lg font-bold flex items-center gap-base">
                    <span className="material-symbols-outlined text-primary">airplane_ticket</span>
                    أرقام التذاكر الصادرة
                  </h2>
                </div>
                <div className="p-md space-y-xs">
                  {documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-sm rounded-lg bg-surface-container-low border border-outline-variant/40">
                      <span className="font-label-md text-label-md text-on-surface-variant">
                        {d.type === "electronic_ticket" ? "تذكرة إلكترونية" : d.type}
                      </span>
                      <span className="font-mono font-bold text-on-surface select-all">{d.supplier_document_id}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Summary + actions */}
          <aside className="flex flex-col gap-md">
            <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
              <h3 className="font-title-lg text-title-lg mb-md font-bold border-b border-outline-variant/30 pb-sm">ملخص الحجز</h3>
              <div className="space-y-xs text-sm text-on-surface-variant">
                <div className="flex justify-between">
                  <span>درجة المقصورة:</span>
                  <span className="font-bold text-on-surface">{booking.snapshot?.cabin_class || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>تاريخ الإنشاء:</span>
                  <span className="font-bold text-on-surface">{formatSystemTimestamp(booking.created_at)}</span>
                </div>
                <div className="flex justify-between border-t border-outline-variant/30 pt-xs mt-xs text-base">
                  <span>الإجمالي المدفوع:</span>
                  <span className="font-extrabold text-primary">{formatMoney(booking.total_amount, booking.currency)}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
              <h3 className="font-title-lg text-title-lg mb-md font-bold border-b border-outline-variant/30 pb-sm">إجراءات</h3>
              <div className="flex flex-col gap-sm">
                {booking.status === "confirmed" && (
                  <button
                    onClick={() => void handleDownloadTicket()}
                    disabled={downloadingPdf}
                    className="w-full bg-primary hover:brightness-110 text-on-primary py-md px-md rounded-xl flex items-center justify-center gap-base font-label-md text-label-md shadow-md active:scale-95 transition-transform cursor-pointer font-bold border-0 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <span className="material-symbols-outlined">{downloadingPdf ? "progress_activity" : "download"}</span>
                    {downloadingPdf ? "جاري تحميل التذكرة..." : "تحميل تذكرة الطيران (PDF)"}
                  </button>
                )}
                {pdfError && (
                  <p className="text-error text-label-sm font-label-sm text-center">{pdfError}</p>
                )}
                {booking.status === "awaiting_payment" && (
                  <Link
                    href={`/checkout/payment?booking_id=${booking.id}`}
                    className="w-full bg-orange-400 hover:bg-orange-500 text-on-tertiary-fixed py-md px-md rounded-xl flex items-center justify-center gap-base font-label-md text-label-md shadow-md active:scale-95 transition-transform font-bold"
                  >
                    <span className="material-symbols-outlined">payment</span>
                    إكمال الدفع
                  </Link>
                )}
                {booking.status === "confirmed" && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full bg-transparent border border-error text-error hover:bg-error-container/20 py-md px-md rounded-xl flex items-center justify-center gap-base font-label-md text-label-md active:scale-95 transition-transform cursor-pointer font-bold"
                  >
                    <span className="material-symbols-outlined">cancel</span>
                    إلغاء الحجز
                  </button>
                )}
              </div>
            </div>

            {/* Support Card */}
            <div className="bg-secondary-container p-md rounded-xl border border-outline-variant/50 text-on-secondary-container flex items-center gap-md">
              <div className="w-12 h-12 bg-surface-container-lowest rounded-full flex items-center justify-center shadow-sm shrink-0">
                <span className="material-symbols-outlined text-primary">support_agent</span>
              </div>
              <div>
                <p className="font-label-md text-label-md font-bold">هل تحتاج لأي مساعدة؟</p>
                <p className="font-label-sm text-label-sm opacity-80 mt-0.5">فريق دعم سفريات جاهز لمساعدتك.</p>
                <Link href="/support" className="text-primary font-bold text-label-sm hover:underline mt-1 block">تواصل مع الدعم</Link>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />

      {showCancelModal && (
        <CancelBookingModal
          booking={booking}
          onClose={() => setShowCancelModal(false)}
          onCancelled={() => void reloadBooking()}
        />
      )}
    </div>
  );
}
