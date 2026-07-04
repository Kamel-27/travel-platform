"use client";

const STEPS = [
  { label: "مراجعة الرحلة", icon: "flight" },
  { label: "بيانات المسافرين", icon: "group" },
  { label: "الدفع الآمن", icon: "lock" },
];

/**
 * Three-step progress indicator for the booking flow
 * (review → passengers → payment). `current` is 1-based.
 */
export default function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-lg" dir="rtl">
      {STEPS.map((step, i) => {
        const stepNo = i + 1;
        const done = stepNo < current;
        const active = stepNo === current;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-xs w-24 md:w-32">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  done
                    ? "bg-primary border-primary text-on-primary"
                    : active
                      ? "bg-primary/10 border-primary text-primary shadow-[0_0_0_4px_rgba(0,63,156,0.08)]"
                      : "bg-surface-container-low border-outline-variant text-outline"
                }`}
              >
                <span className="material-symbols-outlined !text-[20px]">
                  {done ? "check" : step.icon}
                </span>
              </div>
              <span
                className={`font-label-sm text-label-sm text-center ${
                  active ? "text-primary font-bold" : done ? "text-on-surface" : "text-outline"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 md:w-20 mb-5 rounded-full ${
                  stepNo < current ? "bg-primary" : "bg-outline-variant"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
