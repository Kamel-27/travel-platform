"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchAirports, getAirportLabel, type Airport } from "@/lib/airports";

export default function AirportInput({
  icon,
  value,
  onChange,
  placeholder,
}: {
  icon: string;
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const results = useMemo<Airport[]>(() => searchAirports(query), [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayValue = value ? getAirportLabel(value) : "";

  return (
    <div className="relative" ref={ref}>
      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">{icon}</span>
      <input
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 focus:border-primary focus:ring-0 font-body-md text-body-md transition-all"
        value={open ? query : displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        placeholder={placeholder}
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {!query.trim() && (
            <div className="px-3 py-1.5 text-on-surface-variant font-label-sm text-label-sm border-b border-outline-variant/50">
              المطارات الشائعة
            </div>
          )}
          {results.map((airport) => (
            <button
              key={airport.code}
              type="button"
              className="w-full text-right px-3 py-2.5 hover:bg-primary-container/40 transition-colors flex items-center gap-3 cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(airport.code);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="material-symbols-outlined text-outline text-[20px]">flight</span>
              <div className="flex-1">
                <div className="font-body-md text-on-surface">
                  {airport.cityAr}
                  <span className="text-on-surface-variant font-label-sm mr-2">{airport.countryAr}</span>
                </div>
              </div>
              <span className="font-title-md text-primary font-bold">{airport.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
