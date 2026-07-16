"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const WEEKDAYS_AR = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

const WEEKDAY_HEADERS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type SelectingField = "departure" | "return";

interface DatePickerProps {
  departureDate: string;
  returnDate: string;
  onDepartureChange: (value: string) => void;
  onReturnChange: (value: string) => void;
  minDate?: string;
  tripType: "one-way" | "round-trip";
  /** Lets the "add return" placeholder switch the trip type from inside the picker. */
  onTripTypeChange?: (tripType: "one-way" | "round-trip") => void;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const weekday = WEEKDAYS_AR[d.getDay()];
  const day = d.getDate();
  const month = MONTHS_AR[d.getMonth()];
  const year = d.getFullYear();
  return `${weekday}، ${day} ${month} ${year}`;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function DatePicker({
  departureDate,
  returnDate,
  onDepartureChange,
  onReturnChange,
  minDate,
  tripType,
  onTripTypeChange,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<SelectingField>("departure");
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Snapshot taken when the picker opens, so "إلغاء" can restore it
  const snapshotRef = useRef<{ departure: string; return: string } | null>(null);

  const [displayMonth, setDisplayMonth] = useState(() => {
    const base = departureDate ? new Date(departureDate + "T00:00:00") : new Date();
    return isNaN(base.getTime()) ? new Date() : new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const openPicker = useCallback((field: SelectingField) => {
    snapshotRef.current = { departure: departureDate, return: returnDate };
    setSelecting(field);
    const base = field === "departure" && departureDate
      ? new Date(departureDate + "T00:00:00")
      : field === "return" && returnDate
        ? new Date(returnDate + "T00:00:00")
        : departureDate
          ? new Date(departureDate + "T00:00:00")
          : new Date();
    if (!isNaN(base.getTime())) {
      setDisplayMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    setOpen(true);
  }, [departureDate, returnDate]);

  // Close on outside click or Escape. The page keeps scrolling normally and
  // the rest of the search card stays fully interactive while the popover is open.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleCancel = () => {
    if (snapshotRef.current) {
      onDepartureChange(snapshotRef.current.departure);
      onReturnChange(snapshotRef.current.return);
    }
    setOpen(false);
  };

  const handleDayClick = (dateStr: string) => {
    if (selecting === "departure") {
      onDepartureChange(dateStr);
      if (returnDate && dateStr > returnDate) {
        const d = new Date(dateStr + "T00:00:00");
        d.setDate(d.getDate() + 7);
        onReturnChange(d.toISOString().split("T")[0]);
      }
      if (tripType === "round-trip") {
        setSelecting("return");
      } else {
        setOpen(false);
      }
    } else {
      if (dateStr < departureDate) {
        onDepartureChange(dateStr);
        return;
      }
      onReturnChange(dateStr);
      setOpen(false);
    }
  };

  const y1 = displayMonth.getFullYear();
  const m1 = displayMonth.getMonth();
  const nextMonth = new Date(y1, m1 + 1, 1);
  const y2 = nextMonth.getFullYear();
  const m2 = nextMonth.getMonth();

  const todayStr = new Date().toISOString().split("T")[0];

  const isPrevDisabled = (() => {
    if (!minDate) return false;
    const [minY, minM] = minDate.split("-").map(Number);
    return y1 < minY || (y1 === minY && m1 + 1 <= minM);
  })();

  const isInRange = (dateStr: string) => {
    if (tripType !== "round-trip") return false;
    const start = departureDate;
    const end = selecting === "return" && hoveredDate ? hoveredDate : returnDate;
    if (!start || !end) return false;
    return dateStr > start && dateStr < end;
  };

  const renderMonthGrid = (year: number, month: number) => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    return (
      <div>
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_HEADERS.map((h, i) => (
            <div key={i} className="text-center text-[12px] text-on-surface-variant/50 font-medium py-2">
              {h}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="h-11" />
          ))}

          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = toDateStr(year, month, dayNum);
            const isPast = (minDate && dateStr < minDate) || false;
            const isDepSelected = dateStr === departureDate;
            const isRetSelected = tripType === "round-trip" && dateStr === returnDate;
            const isSelected = isDepSelected || isRetSelected;
            const inRange = isInRange(dateStr);
            const isToday = todayStr === dateStr;

            return (
              <div
                key={dayNum}
                className={`relative h-11 flex items-center justify-center
                  ${inRange ? "bg-primary/6" : ""}
                  ${isDepSelected && tripType === "round-trip" && returnDate ? "bg-gradient-to-l from-primary/6 to-transparent" : ""}
                  ${isRetSelected ? "bg-gradient-to-r from-primary/6 to-transparent" : ""}
                `}
              >
                <button
                  type="button"
                  disabled={isPast}
                  onClick={() => handleDayClick(dateStr)}
                  onMouseEnter={() => {
                    if (selecting === "return" && departureDate) setHoveredDate(dateStr);
                  }}
                  onMouseLeave={() => setHoveredDate(null)}
                  className={`w-10 h-10 flex items-center justify-center rounded-full text-[14px] transition-all relative z-10
                    ${isSelected
                      ? "bg-primary text-on-primary font-bold shadow-md"
                      : isToday
                        ? "font-bold text-primary ring-1 ring-primary/30"
                        : "text-on-surface hover:bg-surface-container-high"
                    }
                    ${isPast ? "!text-on-surface/20 cursor-not-allowed hover:bg-transparent" : "cursor-pointer"}
                  `}
                >
                  {dayNum}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-full" ref={rootRef}>
      {/* Trigger buttons row */}
      <div className="flex items-stretch h-full divide-x divide-x-reverse divide-outline-variant/30">
        {/* Departure trigger */}
        <button
          type="button"
          onClick={() => openPicker("departure")}
          className={`flex-1 flex items-center gap-3 px-5 py-4 transition-all cursor-pointer text-right
            ${open && selecting === "departure" ? "bg-primary/5" : "hover:bg-surface-container/40"}
          `}
        >
          <span className="material-symbols-outlined text-primary !text-[24px] shrink-0">calendar_today</span>
          <div className="min-w-0">
            <div className="text-[11px] text-on-surface-variant/60 font-medium leading-none mb-1.5">الذهاب</div>
            <div className={`text-[15px] font-bold whitespace-nowrap ${departureDate ? "text-on-surface" : "text-on-surface-variant/40"}`}>
              {departureDate ? formatShortDate(departureDate) : "اختر التاريخ"}
            </div>
          </div>
        </button>

        {/* Return trigger — or an "add return" placeholder so the card width stays stable on one-way */}
        {tripType === "round-trip" ? (
          <button
            type="button"
            onClick={() => openPicker("return")}
            className={`flex-1 flex items-center gap-3 px-5 py-4 transition-all cursor-pointer text-right
              ${open && selecting === "return" ? "bg-primary/5" : "hover:bg-surface-container/40"}
            `}
          >
            <span className="material-symbols-outlined text-primary !text-[24px] shrink-0">calendar_today</span>
            <div className="min-w-0">
              <div className="text-[11px] text-on-surface-variant/60 font-medium leading-none mb-1.5">العودة</div>
              <div className={`text-[15px] font-bold whitespace-nowrap ${returnDate ? "text-on-surface" : "text-on-surface-variant/40"}`}>
                {returnDate ? formatShortDate(returnDate) : "اختر التاريخ"}
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onTripTypeChange?.("round-trip");
              openPicker("return");
            }}
            className="flex-1 flex items-center gap-3 px-5 py-4 transition-all cursor-pointer text-right hover:bg-surface-container/40"
          >
            <span className="material-symbols-outlined text-on-surface-variant/40 !text-[24px] shrink-0">add_circle</span>
            <div className="min-w-0">
              <div className="text-[11px] text-on-surface-variant/60 font-medium leading-none mb-1.5">العودة</div>
              <div className="text-[15px] font-bold whitespace-nowrap text-on-surface-variant/40">إضافة عودة</div>
            </div>
          </button>
        )}
      </div>

      {/* Calendar popover — anchored under the date fields, no backdrop, page stays scrollable */}
      {open && (
        <div
          dir="rtl"
          className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 z-[70] w-[min(94vw,720px)] bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
        >
            {/* Header tabs */}
            <div className="flex border-b border-outline-variant/40">
              <button
                type="button"
                onClick={() => setSelecting("departure")}
                className={`flex-1 py-4 text-center transition-colors cursor-pointer relative
                  ${selecting === "departure" ? "text-primary" : "text-on-surface-variant hover:text-on-surface"}
                `}
              >
                <div className="text-[11px] font-medium text-on-surface-variant/50 mb-1">الذهاب</div>
                <div className="text-[15px] font-bold">{departureDate ? formatShortDate(departureDate) : "—"}</div>
                {selecting === "departure" && (
                  <div className="absolute bottom-0 left-6 right-6 h-[2.5px] bg-primary rounded-full" />
                )}
              </button>
              {tripType === "round-trip" && (
                <button
                  type="button"
                  onClick={() => setSelecting("return")}
                  className={`flex-1 py-4 text-center transition-colors cursor-pointer relative border-r border-outline-variant/30
                    ${selecting === "return" ? "text-primary" : "text-on-surface-variant hover:text-on-surface"}
                  `}
                >
                  <div className="text-[11px] font-medium text-on-surface-variant/50 mb-1">العودة</div>
                  <div className="text-[15px] font-bold">{returnDate ? formatShortDate(returnDate) : "—"}</div>
                  {selecting === "return" && (
                    <div className="absolute bottom-0 left-6 right-6 h-[2.5px] bg-primary rounded-full" />
                  )}
                </button>
              )}
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between px-8 pt-5 pb-3">
              <button
                type="button"
                onClick={() => setDisplayMonth(new Date(y1, m1 - 1, 1))}
                disabled={isPrevDisabled}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors disabled:opacity-20 cursor-pointer text-on-surface-variant"
              >
                <span className="material-symbols-outlined !text-[22px]">chevron_right</span>
              </button>
              <div className="flex items-center md:gap-20">
                <span className="font-bold text-on-surface text-[16px]">{MONTHS_AR[m1]} {y1}</span>
                <span className="hidden md:inline font-bold text-on-surface text-[16px]">{MONTHS_AR[m2]} {y2}</span>
              </div>
              <button
                type="button"
                onClick={() => setDisplayMonth(new Date(y1, m1 + 1, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface-variant"
              >
                <span className="material-symbols-outlined !text-[22px]">chevron_left</span>
              </button>
            </div>

            {/* Dual-month grid */}
            <div className="px-8 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>{renderMonthGrid(y1, m1)}</div>
                {/* Second month is desktop-only; mobile gets a compact single-month sheet */}
                <div className="hidden md:block">{renderMonthGrid(y2, m2)}</div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer px-5 py-2.5 rounded-xl hover:bg-surface-container-high"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-primary text-on-primary px-8 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.97]"
              >
                تأكيد
              </button>
            </div>
        </div>
      )}
    </div>
  );
}
