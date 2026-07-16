"use client";

import { useEffect, useRef, useState } from "react";

export interface PaxCabinValue {
  adults: number;
  children: number;
  infants: number;
  cabin: string;
}

const CABIN_LABELS: Record<string, string> = {
  economy: "الدرجة الاقتصادية",
  premium_economy: "اقتصادية مميزة",
  business: "درجة رجال الأعمال",
  first: "الدرجة الأولى",
};

function paxSummary(total: number): string {
  if (total === 1) return "مسافر واحد";
  if (total === 2) return "مسافران";
  if (total <= 10) return `${total} مسافرين`;
  return `${total} مسافراً`;
}

function StepperRow({
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="font-label-lg text-label-lg font-bold text-on-surface">{label}</div>
        <div className="text-[12px] text-on-surface-variant/70 mt-0.5">{sublabel}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`إنقاص ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center text-primary hover:bg-primary/5 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined !text-[18px]">remove</span>
        </button>
        <span className="w-6 text-center font-bold text-on-surface tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`زيادة ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center text-primary hover:bg-primary/5 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined !text-[18px]">add</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Passengers + cabin class picker (popover). Values map 1:1 to the flight
 * search API: adults / children / infants / cabin_class.
 * Constraints: 1-9 adults, seated passengers (adults + children) ≤ 9,
 * infants ≤ adults (lap infants).
 */
export default function PaxCabinPicker({
  value,
  onChange,
}: {
  value: PaxCabinValue;
  onChange: (value: PaxCabinValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const total = value.adults + value.children + value.infants;
  const setAdults = (adults: number) =>
    onChange({ ...value, adults, infants: Math.min(value.infants, adults) });

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer ${
          open
            ? "border-primary bg-primary/5"
            : "border-outline-variant/60 hover:border-outline-variant hover:bg-surface-container/40"
        }`}
      >
        <span className="material-symbols-outlined text-on-surface-variant !text-[20px]">group</span>
        <span className="font-label-md text-label-md font-bold text-on-surface whitespace-nowrap">
          {paxSummary(total)} · {CABIN_LABELS[value.cabin] ?? value.cabin}
        </span>
        <span className={`material-symbols-outlined text-on-surface-variant !text-[18px] transition-transform ${open ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {open && (
        <div
          dir="rtl"
          className="absolute top-[calc(100%+8px)] right-0 z-[70] w-[min(92vw,340px)] bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="text-[11px] text-on-surface-variant/60 font-bold mb-1">المسافرون</div>
          <div className="divide-y divide-outline-variant/30">
            <StepperRow
              label="بالغون"
              sublabel="12 سنة فأكثر"
              value={value.adults}
              min={1}
              max={9 - value.children}
              onChange={setAdults}
            />
            <StepperRow
              label="أطفال"
              sublabel="من 2 إلى 11 سنة"
              value={value.children}
              min={0}
              max={9 - value.adults}
              onChange={(children) => onChange({ ...value, children })}
            />
            <StepperRow
              label="رضع"
              sublabel="أقل من سنتين (في حضن البالغ)"
              value={value.infants}
              min={0}
              max={value.adults}
              onChange={(infants) => onChange({ ...value, infants })}
            />
          </div>

          <div className="text-[11px] text-on-surface-variant/60 font-bold mt-4 mb-2">درجة السفر</div>
          <div className="space-y-1">
            {Object.entries(CABIN_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ ...value, cabin: key })}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-right font-label-md text-label-md transition-colors cursor-pointer ${
                  value.cabin === key
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-on-surface hover:bg-surface-container"
                }`}
              >
                {label}
                {value.cabin === key && (
                  <span className="material-symbols-outlined !text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full mt-4 bg-primary text-on-primary py-2.5 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
          >
            تم
          </button>
        </div>
      )}
    </div>
  );
}
