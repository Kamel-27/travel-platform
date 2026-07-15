"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const WEEKDAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const WEEKDAY_HEADERS_AR = ["س", "ح", "ن", "ث", "ر", "خ", "ج"]; // Sat to Fri

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  placeholder?: string;
  icon?: string;
}

function formatToArabicDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(date.getTime())) return dateStr;
  const weekday = WEEKDAYS_AR[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_AR[date.getMonth()];
  const year = date.getFullYear();
  return `${weekday}، ${day} ${month} ${year}`;
}

export default function DatePicker({
  value,
  onChange,
  minDate,
  placeholder = "اختر التاريخ",
  icon = "calendar_today",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Initialize display month to selected date or today
  const [currentDate, setCurrentDate] = useState(() => {
    const initial = value ? new Date(value) : new Date();
    return isNaN(initial.getTime()) ? new Date() : initial;
  });

  const [prevValue, setPrevValue] = useState(value);

  // Sync internal display month with value change
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setCurrentDate(parsed);
      }
    }
  }

  // Prevent scroll behind modal when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close modal when clicking outside of the modal card
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  // Month 1 Calculations (Current display month)
  const year1 = currentDate.getFullYear();
  const month1 = currentDate.getMonth();

  // Month 2 Calculations (Next month)
  const date2 = new Date(year1, month1 + 1, 1);
  const year2 = date2.getFullYear();
  const month2 = date2.getMonth();

  // Calendar logic helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // Saturday is start of week (index 0). Offset mapping:
    // Sat(6)->0, Sun(0)->1, Mon(1)->2, Tue(2)->3, Wed(3)->4, Thu(4)->5, Fri(5)->6
    return (day + 1) % 7;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year1, month1 - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year1, month1 + 1, 1));
  };

  // Min date boundary check for chronological navigation
  const isPrevDisabled = (() => {
    if (!minDate) return false;
    const minParts = minDate.split("-");
    if (minParts.length !== 3) return false;
    const minYear = Number(minParts[0]);
    const minMonth = Number(minParts[1]) - 1;
    return year1 < minYear || (year1 === minYear && month1 <= minMonth);
  })();

  const todayStr = new Date().toISOString().split("T")[0];
  const displayValue = value ? formatToArabicDate(value) : "";

  // Render Month Grid helper
  const renderMonthGrid = (year: number, month: number) => {
    const totalDays = getDaysInMonth(year, month);
    const offset = getFirstDayOffset(year, month);

    return (
      <div className="grid grid-cols-7 gap-1 text-center">
        {/* Weekday Headers */}
        {WEEKDAY_HEADERS_AR.map((h, i) => (
          <div key={i} className="text-[12px] text-text-secondary font-bold py-2">
            {h}
          </div>
        ))}

        {/* Empty Slots */}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} className="w-10 h-10" />
        ))}

        {/* Month Days */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
            dayNum
          ).padStart(2, "0")}`;

          const isPast = minDate && dateStr < minDate;
          const isSelected = value === dateStr;
          const isToday = todayStr === dateStr;

          return (
            <button
              key={dayNum}
              type="button"
              disabled={isPast || false}
              onClick={() => {
                onChange(dateStr);
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm transition-all cursor-pointer font-semibold text-center
                ${
                  isSelected
                    ? "bg-[#0f766e] text-white font-bold shadow-lg active:scale-95"
                    : isToday
                    ? "border border-[#0f766e] text-[#14b8a6] hover:bg-[#1f2b3d]"
                    : "text-[#f1f5f9] hover:bg-[#1f2b3d]"
                }
                ${
                  isPast
                    ? "!text-text-muted cursor-not-allowed opacity-25 hover:bg-transparent"
                    : ""
                }
              `}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 hover:border-outline focus:border-primary focus:ring-0 font-body-md text-body-md transition-all text-right flex items-center relative cursor-pointer text-on-surface"
      >
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none !text-[20px]">
          {icon}
        </span>
        <span className={displayValue ? "text-on-surface" : "text-outline"}>
          {displayValue || placeholder}
        </span>
      </button>

      {open && (
        <div
          onClick={handleBackdropClick}
          className="fixed inset-0 bg-[#0b1120]/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            ref={modalRef}
            className="bg-[#1a2332] border border-[#1e3a5f] shadow-2xl rounded-2xl p-6 max-w-[700px] w-full relative animate-in fade-in zoom-in-95 duration-200 text-right"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#1e3a5f]/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#14b8a6] !text-[22px]">
                  calendar_today
                </span>
                <h3 className="font-bold text-lg text-white">اختر تاريخ السفر</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-[#1f2b3d] rounded-lg transition-colors cursor-pointer text-text-secondary hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined !text-[22px]">close</span>
              </button>
            </div>

            {/* Double-Month Grid Wrapper */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 overflow-y-auto max-h-[400px] md:max-h-none">
              {/* Right Month (Month 1: chronological first) */}
              <div>
                <div className="flex justify-between items-center mb-4 px-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    disabled={isPrevDisabled}
                    className="p-1.5 hover:bg-[#1f2b3d] rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer flex items-center justify-center text-white"
                  >
                    <span className="material-symbols-outlined !text-[20px] font-bold">
                      chevron_right
                    </span>
                  </button>
                  <div className="font-bold text-white text-base">
                    {MONTHS_AR[month1]} {year1}
                  </div>
                  <div className="w-8" />
                </div>
                {renderMonthGrid(year1, month1)}
              </div>

              {/* Left Month (Month 2: chronological second) */}
              <div>
                <div className="flex justify-between items-center mb-4 px-2">
                  <div className="w-8" />
                  <div className="font-bold text-white text-base">
                    {MONTHS_AR[month2]} {year2}
                  </div>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-[#1f2b3d] rounded-lg transition-colors cursor-pointer flex items-center justify-center text-white"
                  >
                    <span className="material-symbols-outlined !text-[20px] font-bold">
                      chevron_left
                    </span>
                  </button>
                </div>
                {renderMonthGrid(year2, month2)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-[#1e3a5f]/40 gap-4">
              <div className="text-sm text-text-secondary text-right">
                {value ? (
                  <span>
                    التاريخ المحدد:{" "}
                    <strong className="text-[#14b8a6]">{formatToArabicDate(value)}</strong>
                  </span>
                ) : (
                  <span>لم يتم تحديد تاريخ بعد</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full sm:w-auto bg-[#0f766e] hover:bg-[#0d5c56] text-white px-8 py-2.5 rounded-xl font-bold shadow-md cursor-pointer transition-colors text-center"
              >
                تأكيد التاريخ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
