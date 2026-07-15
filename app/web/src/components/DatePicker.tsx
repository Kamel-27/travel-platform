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
  return `${weekday}، ${day} ${month}`;
}

export default function DatePicker({
  value,
  onChange,
  minDate,
  placeholder = "اختر التاريخ",
  icon = "calendar_today",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  // Close popover when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Calendar logic
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // Saturday is start of week (index 0). Map day to offset:
    // Sat(6)->0, Sun(0)->1, Mon(1)->2, Tue(2)->3, Wed(3)->4, Thu(4)->5, Fri(5)->6
    return (day + 1) % 7;
  };

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const offset = getFirstDayOffset(currentYear, currentMonth);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Min date boundary check (disable navigation before minDate's month)
  const isPrevDisabled = (() => {
    if (!minDate) return false;
    const minParts = minDate.split("-");
    if (minParts.length !== 3) return false;
    const minYear = Number(minParts[0]);
    const minMonth = Number(minParts[1]) - 1;
    return currentYear < minYear || (currentYear === minYear && currentMonth <= minMonth);
  })();

  const todayStr = new Date().toISOString().split("T")[0];
  const displayValue = value ? formatToArabicDate(value) : "";

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
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
        <div className="absolute top-full right-0 mt-2 bg-[#1a2332] border border-[#1e3a5f] shadow-2xl rounded-xl p-4 z-[100] w-[310px]">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={isPrevDisabled}
              className="p-1 hover:bg-[#1f2b3d] rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer flex items-center justify-center text-on-surface"
            >
              <span className="material-symbols-outlined !text-[20px] font-bold">
                chevron_right
              </span>
            </button>
            <div className="font-title-md text-on-surface font-bold">
              {MONTHS_AR[currentMonth]} {currentYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-[#1f2b3d] rounded-lg transition-colors cursor-pointer flex items-center justify-center text-on-surface"
            >
              <span className="material-symbols-outlined !text-[20px] font-bold">
                chevron_left
              </span>
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {WEEKDAY_HEADERS_AR.map((h, i) => (
              <div
                key={i}
                className="text-[12px] text-text-secondary font-bold py-1"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty Slots */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`empty-${i}`} className="w-9 h-9" />
            ))}

            {/* Month Days */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(
                2,
                "0"
              )}-${String(dayNum).padStart(2, "0")}`;

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
                    setOpen(false);
                  }}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-all cursor-pointer font-medium
                    ${
                      isSelected
                        ? "bg-[#0f766e] text-white font-bold"
                        : isToday
                        ? "border border-[#0f766e] text-[#14b8a6] hover:bg-[#1f2b3d]"
                        : "text-on-surface hover:bg-[#1f2b3d]"
                    }
                    ${
                      isPast
                        ? "!text-text-muted cursor-not-allowed opacity-35 hover:bg-transparent"
                        : ""
                    }
                  `}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
