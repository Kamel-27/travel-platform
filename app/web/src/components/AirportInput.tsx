"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchAirports, getAirportLabel, type Airport, AIRPORTS } from "@/lib/airports";
import { api } from "@/lib/api-client";

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
  const [suggestions, setSuggestions] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const displayValue = value ? getAirportLabel(value) : "";
  // On focus the input shows the current label (selected); until the user
  // actually types, search as if the field were empty so popular airports show.
  const effectiveQuery = query === displayValue ? "" : query;

  // Debounced autocomplete fetch from backend
  useEffect(() => {
    if (effectiveQuery.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        interface SearchResult {
          code: string;
          city: string;
          country: string;
          type: string;
          name: string;
        }
        const response = await api.get<{ data: SearchResult[] }>(
          `/flights/airports/search?query=${encodeURIComponent(effectiveQuery)}`,
          { skipAuth: true }
        );
        if (response && response.data) {
          const apiAirports: Airport[] = response.data.map((item: SearchResult) => {
            const localMatch = AIRPORTS.find((a) => a.code === item.code);
            return {
              code: item.code,
              city: item.city,
              cityAr: localMatch ? localMatch.cityAr : item.city,
              country: item.country,
              countryAr: localMatch ? localMatch.countryAr : item.country,
              name: item.name,
              nameAr: localMatch ? localMatch.nameAr : undefined,
              type: item.type,
            };
          });
          setSuggestions(apiAirports);
        }
      } catch (err) {
        console.error("Error fetching airport suggestions:", err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [effectiveQuery]);

  const results = useMemo<Airport[]>(() => {
    const localResults = searchAirports(effectiveQuery);
    const combined = [...localResults];
    suggestions.forEach((s) => {
      if (!combined.some((c) => c.code === s.code)) {
        combined.push(s);
      }
    });
    return combined;
  }, [effectiveQuery, suggestions]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectAirport = (airport: Airport) => {
    onChange(airport.code);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const airport = results[Math.min(activeIndex, results.length - 1)];
      if (airport) selectAirport(airport);
    }
  };

  return (
    <div className="relative" ref={ref}>
      {icon && <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">{icon}</span>}
      <input
        className={`w-full focus:ring-0 transition-all ${icon ? "bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 font-body-md text-body-md focus:border-primary" : "bg-transparent border-none p-0 text-sm font-bold text-on-surface focus:outline-none placeholder:text-on-surface-variant/50 truncate"}`}
        value={open ? query : displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          if (!open) setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          setQuery(displayValue);
          setActiveIndex(0);
          e.currentTarget.select();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute top-full right-0 mt-1 w-full min-w-[320px] max-w-[92vw] bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-4 py-2.5 text-xs text-outline flex items-center gap-2 border-b border-outline-variant/30 bg-surface-container-low/30">
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-[#0f766e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[#0f766e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[#0f766e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="mr-1">جاري البحث عن المطارات...</span>
            </div>
          )}
          {!effectiveQuery.trim() && (
            <div className="px-3 py-1.5 text-on-surface-variant font-label-sm text-label-sm border-b border-outline-variant/50">
              المطارات الشائعة
            </div>
          )}
          {results.map((airport, index) => (
            <button
              key={airport.code}
              type="button"
              ref={index === activeIndex ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
              className={`w-full text-right px-4 py-3 transition-colors flex items-center gap-3 cursor-pointer border-b border-outline-variant/30 last:border-b-0 ${index === activeIndex ? "bg-surface-container-high" : "hover:bg-surface-container-high"}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectAirport(airport);
              }}
            >
              <span className="material-symbols-outlined text-outline text-[22px] pointer-events-none">
                {airport.type === "city" ? "location_city" : "flight"}
              </span>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-on-surface text-base">
                    {airport.cityAr || airport.city}
                  </span>
                  <span className="text-on-surface-variant font-label-sm font-bold">
                    ({airport.code})
                  </span>
                </div>
                <div className="text-on-surface-variant text-xs truncate mt-0.5">
                  {airport.type === "city"
                    ? "جميع المطارات"
                    : (airport.nameAr || airport.name || "مطار")}
                  {airport.countryAr ? ` · ${airport.countryAr}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
