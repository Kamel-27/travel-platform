"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Airport data (shared with flights page)
// ---------------------------------------------------------------------------

interface Airport {
  code: string;
  city: string;
  cityAr: string;
  country: string;
  countryAr: string;
}

const AIRPORTS: Airport[] = [
  { code: "RUH", city: "Riyadh", cityAr: "الرياض", country: "Saudi Arabia", countryAr: "السعودية" },
  { code: "JED", city: "Jeddah", cityAr: "جدة", country: "Saudi Arabia", countryAr: "السعودية" },
  { code: "DMM", city: "Dammam", cityAr: "الدمام", country: "Saudi Arabia", countryAr: "السعودية" },
  { code: "MED", city: "Medina", cityAr: "المدينة المنورة", country: "Saudi Arabia", countryAr: "السعودية" },
  { code: "DXB", city: "Dubai", cityAr: "دبي", country: "UAE", countryAr: "الإمارات" },
  { code: "AUH", city: "Abu Dhabi", cityAr: "أبوظبي", country: "UAE", countryAr: "الإمارات" },
  { code: "SHJ", city: "Sharjah", cityAr: "الشارقة", country: "UAE", countryAr: "الإمارات" },
  { code: "DOH", city: "Doha", cityAr: "الدوحة", country: "Qatar", countryAr: "قطر" },
  { code: "BAH", city: "Bahrain", cityAr: "البحرين", country: "Bahrain", countryAr: "البحرين" },
  { code: "KWI", city: "Kuwait", cityAr: "الكويت", country: "Kuwait", countryAr: "الكويت" },
  { code: "MCT", city: "Muscat", cityAr: "مسقط", country: "Oman", countryAr: "عمان" },
  { code: "AMM", city: "Amman", cityAr: "عمّان", country: "Jordan", countryAr: "الأردن" },
  { code: "BEY", city: "Beirut", cityAr: "بيروت", country: "Lebanon", countryAr: "لبنان" },
  { code: "CAI", city: "Cairo", cityAr: "القاهرة", country: "Egypt", countryAr: "مصر" },
  { code: "IST", city: "Istanbul", cityAr: "إسطنبول", country: "Turkey", countryAr: "تركيا" },
  { code: "LHR", city: "London", cityAr: "لندن", country: "United Kingdom", countryAr: "بريطانيا" },
  { code: "CDG", city: "Paris", cityAr: "باريس", country: "France", countryAr: "فرنسا" },
  { code: "JFK", city: "New York", cityAr: "نيويورك", country: "United States", countryAr: "أمريكا" },
  { code: "BKK", city: "Bangkok", cityAr: "بانكوك", country: "Thailand", countryAr: "تايلاند" },
  { code: "KUL", city: "Kuala Lumpur", cityAr: "كوالالمبور", country: "Malaysia", countryAr: "ماليزيا" },
];

const POPULAR_CODES = ["RUH", "JED", "DXB", "DOH", "CAI", "IST", "LHR", "CDG"];

function searchAirports(query: string): Airport[] {
  if (!query.trim()) return AIRPORTS.filter((a) => POPULAR_CODES.includes(a.code));
  const q = query.toLowerCase();
  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.cityAr.includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.countryAr.includes(q)
  ).slice(0, 8);
}

function getAirportByCode(code: string): Airport | undefined {
  return AIRPORTS.find((a) => a.code === code.toUpperCase());
}

function getDisplayLabel(code: string): string {
  const airport = getAirportByCode(code);
  return airport ? `${airport.cityAr} (${airport.code})` : code;
}

function HomeAirportInput({
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

  const displayValue = value ? getDisplayLabel(value) : "";

  return (
    <div className="relative" ref={ref}>
      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline">{icon}</span>
      <input
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 focus:border-primary focus:ring-0 font-body-md text-body-md transition-all"
        value={open ? query : displayValue}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(""); }}
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
              onMouseDown={(e) => { e.preventDefault(); onChange(airport.code); setQuery(""); setOpen(false); }}
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


export default function HomepagePage() {

  const router = useRouter();
  const [activeTab, setActiveTab] = useState('flights');
  const [flightOrigin, setFlightOrigin] = useState("RUH");
  const [flightDest, setFlightDest] = useState("DXB");
  const [tripType, setTripType] = useState<"one-way" | "round-trip">("round-trip");
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })();
  const weekLaterDate = (() => { const d = new Date(); d.setDate(d.getDate() + 8); return d.toISOString().split("T")[0]; })();
  const [flightDate, setFlightDate] = useState(tomorrowDate);
  const [flightReturnDate, setFlightReturnDate] = useState(weekLaterDate);

  const handleFlightSearch = () => {
    const params = new URLSearchParams({ origin: flightOrigin, destination: flightDest, date: flightDate, adults: "1" });
    if (tripType === "round-trip" && flightReturnDate) params.set("return_date", flightReturnDate);
    router.push(`/flights?${params}`);
  };

  useEffect(() => {
    const handleScroll = () => {
      const header = document.querySelector('header');
      if (!header) return;
      if (window.scrollY > 50) {
        header.classList.add('shadow-md');
      } else {
        header.classList.remove('shadow-md');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      
<header className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm sticky top-0 z-50 transition-all duration-300">
<div className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-16">
<div className="flex items-center gap-lg">
<Link href="/">
  <span className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary cursor-pointer">Safariyat</span>
</Link>
<nav className="hidden md:flex items-center gap-md">
<Link className="text-primary dark:text-inverse-primary font-bold border-b-2 border-primary dark:border-inverse-primary pb-1 font-label-md text-label-md" href="/">رحلات طيران</Link>
<Link className="text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-inverse-primary transition-colors font-label-md text-label-md" href="/hotels">فنادق</Link>
<Link className="text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-inverse-primary transition-colors font-label-md text-label-md" href="/#offers">عروض</Link>
<Link className="text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-inverse-primary transition-colors font-label-md text-label-md" href="/manage-bookings">رحلاتي</Link>
</nav>
</div>
<div className="flex items-center gap-sm">
<div className="hidden md:flex items-center gap-sm text-on-surface-variant">
<button className="material-symbols-outlined p-2 hover:bg-surface-container transition-colors rounded-full" data-icon="language">language</button>
<button className="material-symbols-outlined p-2 hover:bg-surface-container transition-colors rounded-full" data-icon="notifications">notifications</button>
<span className="font-label-md text-label-md px-2">USD / AR</span>
</div>
<Link href="/signin" className="bg-primary text-on-primary px-md py-2 rounded-lg font-label-md text-label-md scale-98 active:scale-95 transition-transform duration-200 text-center flex items-center justify-center">
  تسجيل الدخول
</Link>
</div>
</div>
</header>
<main>

<section className="relative min-h-[600px] flex items-center overflow-hidden">
<div className="absolute inset-0 z-0">
<div className="absolute inset-0 bg-gradient-to-l from-primary/40 to-transparent z-10"></div>
<img className="w-full h-full object-cover" data-alt="A wide-angle cinematic shot of a modern airplane soaring through a golden-hour sky, with soft sunlight reflecting off its polished metallic wings. The atmosphere is serene and expansive, featuring a palette of deep blues, warm oranges, and soft whites. This premium travel-themed imagery emphasizes the excitement of global exploration and high-velocity travel with a clean, high-contrast aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSwD4VcbxKOuIqn7ARjIE0C8i_l4KBrt7hPwIKWDVH_LtB_NNW5OS-qXoW-50N3kQjQJ5IrZpzgWCuteu-pEvQo1ofHG7sk63QbRbFniVjAOjUeFbg8W65-9_SIvjSFu9-5RIFwqoQC_lZ5plUlcINZjKlnf0exC2gKYUmriyicg08DIvisthbOXZyCmkazITGa_X8VsO8w_-SAqVOKv-fanC5G2uLFNBa6fZNsKW9UNs3TMd_QhCNgVJscsl7ZpYgcXIKYeH7RmnT"/>
</div>
<div className="relative z-20 w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-xl">
<div className="max-w-2xl text-white mb-lg">
<h1 className="font-display-lg text-display-lg mb-sm drop-shadow-lg">اكتشف العالم بلمسة واحدة</h1>
<p className="font-body-lg text-body-lg opacity-90 drop-shadow-md">أفضل عروض الطيران والفنادق لوجهتك القادمة - أسعار لا تقبل المنافسة</p>
</div>

<div className="glass-effect rounded-xl shadow-2xl p-sm md:p-md max-w-5xl">
<div className="flex gap-md mb-base border-b border-outline-variant/30 pb-sm">
<button 
  className={`flex items-center gap-xs pb-sm transition-all duration-200 cursor-pointer ${activeTab === 'flights' ? "text-primary font-bold border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"}`} 
  onClick={() => setActiveTab('flights')}
>
<span className="material-symbols-outlined" data-icon="flight" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>flight</span>
<span className="font-label-md text-label-md">رحلات طيران</span>
</button>
<button 
  className={`flex items-center gap-xs pb-sm transition-all duration-200 cursor-pointer ${activeTab === 'hotels' ? "text-primary font-bold border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"}`} 
  onClick={() => setActiveTab('hotels')}
>
<span className="material-symbols-outlined" data-icon="hotel">hotel</span>
<span className="font-label-md text-label-md">فنادق</span>
</button>
</div>

{activeTab === 'flights' ? (
  <div className="space-y-3">
    <div className="flex gap-3">
      <button type="button" onClick={() => { setTripType("one-way"); setFlightReturnDate(""); }}
        className={`px-3 py-1 rounded-full font-label-sm text-label-sm transition-colors ${tripType === "one-way" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
        ذهاب فقط
      </button>
      <button type="button" onClick={() => { setTripType("round-trip"); if (!flightReturnDate) setFlightReturnDate(weekLaterDate); }}
        className={`px-3 py-1 rounded-full font-label-sm text-label-sm transition-colors ${tripType === "round-trip" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
        ذهاب وعودة
      </button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-12 gap-base items-end">
      <div className="md:col-span-3 space-y-xs">
        <label className="font-label-sm text-label-sm text-on-surface-variant block px-base">من أين؟</label>
        <HomeAirportInput icon="flight_takeoff" value={flightOrigin} onChange={setFlightOrigin} placeholder="اختر مطار المغادرة" />
      </div>
      <div className="md:col-span-3 space-y-xs">
        <label className="font-label-sm text-label-sm text-on-surface-variant block px-base">إلى أين؟</label>
        <HomeAirportInput icon="flight_land" value={flightDest} onChange={setFlightDest} placeholder="اختر مطار الوصول" />
      </div>
      <div className={tripType === "round-trip" ? "md:col-span-2 space-y-xs" : "md:col-span-5 space-y-xs"}>
        <label className="font-label-sm text-label-sm text-on-surface-variant block px-base">{tripType === "round-trip" ? "الذهاب" : "التاريخ"}</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">calendar_today</span>
          <input type="date" min={todayStr} value={flightDate}
            onChange={(e) => { setFlightDate(e.target.value); if (flightReturnDate && e.target.value > flightReturnDate) { const d = new Date(e.target.value); d.setDate(d.getDate() + 7); setFlightReturnDate(d.toISOString().split("T")[0]); } }}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 focus:border-primary focus:ring-0 font-body-md text-body-md transition-all" />
        </div>
      </div>
      {tripType === "round-trip" && (
        <div className="md:col-span-2 space-y-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant block px-base">العودة</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">calendar_today</span>
            <input type="date" min={flightDate || todayStr} value={flightReturnDate}
              onChange={(e) => setFlightReturnDate(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 focus:border-primary focus:ring-0 font-body-md text-body-md transition-all" />
          </div>
        </div>
      )}
      <div className={tripType === "round-trip" ? "md:col-span-2" : "md:col-span-1"}>
        <button onClick={handleFlightSearch} className="w-full h-[50px] bg-tertiary text-on-tertiary rounded-lg flex items-center justify-center hover:bg-tertiary-container transition-all active:scale-95 shadow-lg cursor-pointer">
          <span className="material-symbols-outlined text-3xl">search</span>
        </button>
      </div>
    </div>
  </div>
) : (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-base items-end">
    <div className="md:col-span-5 space-y-xs">
      <label className="font-label-sm text-label-sm text-on-surface-variant block px-base">الوجهة أو اسم الفندق</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline" data-icon="hotel">hotel</span>
        <input className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 focus:border-primary focus:ring-0 font-body-md text-body-md transition-all" placeholder="دبي، الإمارات العربية المتحدة" type="text"/>
      </div>
    </div>
    <div className="md:col-span-4 space-y-xs">
      <label className="font-label-sm text-label-sm text-on-surface-variant block px-base">تاريخ الدخول والمغادرة</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline" data-icon="calendar_today">date_range</span>
        <input className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 focus:border-primary focus:ring-0 font-body-md text-body-md transition-all" placeholder="20 أكتوبر - 25 أكتوبر" type="text"/>
      </div>
    </div>
    <div className="md:col-span-2 space-y-xs">
      <label className="font-label-sm text-label-sm text-on-surface-variant block px-base">الغرف والضيوف</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline" data-icon="group">group</span>
        <input className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pr-10 pl-4 focus:border-primary focus:ring-0 font-body-md text-body-md transition-all" placeholder="غرفة واحدة، ضيفين" type="text"/>
      </div>
    </div>
    <div className="md:col-span-1">
      <Link href="/hotels" className="w-full h-[50px] bg-tertiary text-on-tertiary rounded-lg flex items-center justify-center hover:bg-tertiary-container transition-all active:scale-95 shadow-lg">
        <span className="material-symbols-outlined text-3xl" data-icon="search">search</span>
      </Link>
    </div>
  </div>
)}
</div>
</div>
</section>

<section className="py-xl px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
<div className="flex justify-between items-end mb-lg">
<div>
<h2 className="font-headline-lg text-headline-lg text-primary mb-xs">الوجهات الأكثر رواجاً</h2>
<p className="text-on-surface-variant font-body-md text-body-md">استلهم رحلتك القادمة من أفضل الوجهات المختارة</p>
</div>
<button className="text-primary font-bold flex items-center gap-xs hover:underline transition-all">
                    عرض الكل <span className="material-symbols-outlined text-[18px]" data-icon="arrow_back">arrow_back</span>
</button>
</div>
<div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-md h-auto md:h-[600px]">

<div className="md:col-span-2 md:row-span-2 relative rounded-xl overflow-hidden group cursor-pointer shadow-sm">
<img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" data-alt="A magnificent sunset view of the Taj Mahal in Agra, India, reflected in the still waters of the long pool. The lighting is ethereal, with golden and purple hues painting the sky. The image captures the grandeur and intricate details of the marble architecture, presented in a high-fidelity photographic style that evokes a sense of timeless wonder and historical richness." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAbv8_2X8FZ4uvoW6NVhti73gVxTUGAIY2DEwq6M4RnMlWG35Hc56Ub5bsmE65aKyNx0JonS2ZrRchGPfzNORWhg5cCBdu6PzW63F9WpVdoClOzRHVHoGDry5B_8J2NMO8ESujU1j5DSF17DMqxULgS-KZh5H9yU3Q687AmQvoljMk0JIGoIYix6BKRLGnXTAf24MoftGwoFQEtUksE_79oihCs8mNyYYXCqy54oTQVmMJpJw3yYGrkt07Z_8SOuKouOtcgyH-3_EpL"/>
<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
<div className="absolute bottom-md right-md text-white">
<span className="bg-tertiary text-on-tertiary px-sm py-xs rounded-full text-label-sm font-label-sm mb-base inline-block">رحلة تاريخية</span>
<h3 className="font-headline-md text-headline-md">أغرا، الهند</h3>
<p className="opacity-80 font-body-md text-body-md">اكتشف عجائب الدنيا السبع</p>
</div>
</div>

<div className="md:col-span-2 relative rounded-xl overflow-hidden group cursor-pointer shadow-sm">
<img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" data-alt="The stunning skyline of Dubai at dusk, featuring the Burj Khalifa towering over illuminated skyscrapers. The city lights create a brilliant electrical glow against the deep twilight sky. The image is captured with professional wide-angle lenses to emphasize the modern, fast-paced, and luxurious energy of the city, perfectly aligning with a high-velocity corporate travel aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCz9XdoRqQkCfNGDx8uEGvFQUdmwLD0GG6814UyYJTU6Uf7gjaiwj0Lf3kV-MI9RmC_679gHcssOTfl20Ob4anARXKgFCsZaP9iH9ZlWyDm1-hvwWmb5-e3BF7C1T8KsiFbt2jjotKhORyp50U6vb09J1tJvHfotJU14Clx-uIR9gBjyQ2pLkOG28e3G42edMXR0pl4YrEWHawHKMpSpCNfwdSjGSbwnIRl0jEZk0BC5jVJDEVHAk5aPR3WRu3wy1AdVMfkqYBiAlYm"/>
<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
<div className="absolute bottom-md right-md text-white">
<h3 className="font-title-lg text-title-lg">دبي، الإمارات</h3>
<p className="opacity-80 font-label-md text-label-md">الفخامة في كل زاوية</p>
</div>
</div>

<div className="relative rounded-xl overflow-hidden group cursor-pointer shadow-sm">
<img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" data-alt="A lush tropical scene in Bali, Indonesia, with vibrant green rice terraces cascading down a hillside under a soft, diffused morning mist. The lighting is organic and peaceful, highlighting the varied textures of the foliage. The image creates a serene and rejuvenating mood, focusing on the natural beauty and tranquil essence of the destination." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMjzkQ8kohS4139Fdyz_QjDqfJe4kTKTALNm6K6uY1LKnXX7w_as_-8EzjF0iBBYNnhpkgm-yKuU7kvDgZwQ2mbjYfGQ3xVGA_XBx-_CvUmsPWGcbpRpWcaGX_ylvFwekUW2I4XXhwqyzgNG_V4tHVyQqXMirmF4iy9LfWzAHwURisdf-jJd09L-cm9YAGLNUEaH7Eve6Lss2jG4sshiql4I9zP8bTIug3TLdB9VZ1RWsR7ZQjybZ8z2I2xK1yduJL1z0ZGPuAvLIr"/>
<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
<div className="absolute bottom-base right-base text-white">
<h3 className="font-title-lg text-title-lg">بالي، إندونيسيا</h3>
</div>
</div>

<div className="relative rounded-xl overflow-hidden group cursor-pointer shadow-sm">
<img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" data-alt="The historic city of Kyoto, Japan, during the cherry blossom season. Traditional wooden temples are framed by delicate pink flowers, with a soft blue sky in the background. The lighting is delicate and high-key, creating a clean and aesthetically pleasing image that highlights cultural heritage and seasonal beauty." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCbJQbMbtM1HiT1EaFZlbEVRqjQIvG9csS8lQ6CUWaEUv70mmJ69T2Iwl3uRhfgsX8IIxREjT21Fdvqk_c-tZrYZD_4s_CygdlfXlAiWESqWz0ySalxozRibtOnXKRQ-g0SJ47MehxOtIJtADlWXdflCWiVYuolWo_rCikDm27DpHpG7o65AECUxCLH-zfbL7hwB999gHyeqjyPeTyNKFTybs70SraEGRLbs0rasxYpBjOX7uGKvFGlN9kxOR814qoG_pa9qvMo6NLL"/>
<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
<div className="absolute bottom-base right-base text-white">
<h3 className="font-title-lg text-title-lg">كيوتو، اليابان</h3>
</div>
</div>
</div>
</section>

<section id="offers" className="bg-surface-container py-xl">
<div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
<div className="mb-lg">
<h2 className="font-headline-lg text-headline-lg text-primary">عروض حصرية لفترة محدودة</h2>
<p className="text-on-surface-variant font-body-md text-body-md">وفر أكثر مع باقاتنا المختارة بعناية</p>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-lg">

<div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant hover:shadow-xl transition-shadow group">
<div className="relative h-48">
<img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" data-alt="The Eiffel Tower standing tall in Paris, France, viewed from a stylish cobblestone street lined with charming cafes. The morning light is soft and inviting, giving the scene a romantic and timeless quality. The palette includes warm neutrals and crisp blues, capturing the quintessentially chic Parisian atmosphere." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAU5MMPjP7PdW3qgh0cpxa5gFtKFUcv2FSFw5asTOmyeewhF5_vwAOQceQtkjX2dtZrIwphlFopFs0o84JA1STp6q0q_nE89xiMjEgdlxFjtlXc2JjShmO1qEz8GYaD19evz3NGQkzc9svBoKeSHyoSGG9vsqrQoAxy-TBd5P8cqzVexQprnGq3niDLXAwSct1WbVwXjN0auhWm0Yk6XAMEFBY5BQjiYGT5pPGk_RVe_AB8UdldDsopM-FTdqMzqT8N_xVZozz1Qn48"/>
<div className="absolute top-sm left-sm bg-error text-on-error px-sm py-1 rounded-full font-label-sm text-label-sm">خصم 30%</div>
</div>
<div className="p-md space-y-sm">
<div className="flex justify-between items-start">
<div>
<h4 className="font-title-lg text-title-lg text-on-surface">باريس، فرنسا</h4>
<p className="text-on-surface-variant font-label-md text-label-md">تذكرة طيران + إقامة 5 ليالي</p>
</div>
<div className="text-left">
<span className="block text-error font-headline-md text-headline-md">$1,200</span>
<span className="block text-outline line-through text-label-sm font-label-sm">$1,800</span>
</div>
</div>
<div className="flex items-center gap-base text-on-surface-variant">
<span className="material-symbols-outlined text-[18px]" data-icon="timer">timer</span>
<span className="font-label-sm text-label-sm">ينتهي العرض خلال 3 أيام</span>
</div>
<Link href="/flights/details" className="block text-center w-full bg-secondary-container text-on-secondary-container py-2 rounded-lg font-bold hover:bg-primary hover:text-on-primary transition-all duration-300">احجز الآن</Link>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant hover:shadow-xl transition-shadow group">
<div className="relative h-48">
<img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" data-alt="A wide landscape of Bangkok, Thailand, showing its majestic temples with ornate golden spires juxtaposed against a modern cityscape. The late afternoon lighting creates a vibrant, high-contrast effect. The image uses a rich color palette of gold, deep red, and sky blue to convey cultural richness and urban dynamism." src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8b3L3diKr-ssA1Le0WTbl5f7ofdbXZMufyZYgN4C2rBY7VCuqGn6E-54F4LNddWFzsxcuBpxLG2mIAfGgeYxQny0UpzkG3QMbNEHVY2yJBQMilOqsanB_r0BS30UKZ8bM-xC6rZe8dV7Syxxt3yH1yXGwkuvKuAsmaql9umR1cDQjgks23iFHpEN2OY70NSfEjUKLMr6vU5vE6lukwlRVxnkxvPJjIpJbKIuYQAJ5aonrb20AW2mHWkc7eXFd92owJ2aHlIkD-wQ3"/>
<div className="absolute top-sm left-sm bg-tertiary text-on-tertiary px-sm py-1 rounded-full font-label-sm text-label-sm">الأكثر مبيعاً</div>
</div>
<div className="p-md space-y-sm">
<div className="flex justify-between items-start">
<div>
<h4 className="font-title-lg text-title-lg text-on-surface">بانكوك، تايلاند</h4>
<p className="text-on-surface-variant font-label-md text-label-md">باقة عائلية متكاملة</p>
</div>
<div className="text-left">
<span className="block text-error font-headline-md text-headline-md">$850</span>
<span className="block text-outline line-through text-label-sm font-label-sm">$1,100</span>
</div>
</div>
<div className="flex items-center gap-base text-on-surface-variant">
<span className="material-symbols-outlined text-[18px]" data-icon="timer">timer</span>
<span className="font-label-sm text-label-sm">ينتهي العرض خلال 5 أيام</span>
</div>
<Link href="/flights/details" className="block text-center w-full bg-secondary-container text-on-secondary-container py-2 rounded-lg font-bold hover:bg-primary hover:text-on-primary transition-all duration-300">احجز الآن</Link>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant hover:shadow-xl transition-shadow group">
<div className="relative h-48">
<img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" data-alt="A cinematic view of the Swiss Alps, with snow-capped peaks rising into a clear blue sky. A luxury mountain chalet is nestled in the foreground, surrounded by evergreen trees. The lighting is crisp and cold, creating a pristine and high-end feel that emphasizes peace, exclusivity, and nature's grandeur." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCEAaAIOYf4HKNIwD9hDVqoKz_3Px0hFGWlzwJPSROaF2_Nf3J_yunVICn5tKQCwhsKRHue3fEq9qWNAG825dC9qUcffYKkYKMclybAq8EscTT9nC7C2_cUKMifSWKiDhXhncPd09V917Vx1mGDZeoi3UeDJbJ10FISFlKT6f4F4NLIkaVanvfY4JtSfuBlO88PtutgisS6jQ_ZGMrNq22bWaH2j-NCeCS126tn3W94wmRqh9MsZyNlH312Zoh0hnqgZij3U-2GNL-b"/>
<div className="absolute top-sm left-sm bg-error text-on-error px-sm py-1 rounded-full font-label-sm text-label-sm">وفر $300</div>
</div>
<div className="p-md space-y-sm">
<div className="flex justify-between items-start">
<div>
<h4 className="font-title-lg text-title-lg text-on-surface">زيورخ، سويسرا</h4>
<p className="text-on-surface-variant font-label-md text-label-md">رحلة شتوية فاخرة</p>
</div>
<div className="text-left">
<span className="block text-error font-headline-md text-headline-md">$1,550</span>
<span className="block text-outline line-through text-label-sm font-label-sm">$1,850</span>
</div>
</div>
<div className="flex items-center gap-base text-on-surface-variant">
<span className="material-symbols-outlined text-[18px]" data-icon="timer">timer</span>
<span className="font-label-sm text-label-sm">ينتهي العرض قريباً</span>
</div>
<Link href="/hotels/details" className="block text-center w-full bg-secondary-container text-on-secondary-container py-2 rounded-lg font-bold hover:bg-primary hover:text-on-primary transition-all duration-300">احجز الآن</Link>
</div>
</div>
</div>
</div>
</section>

<section className="py-xl px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
<div className="bg-primary-container rounded-2xl p-lg md:p-xl flex flex-col md:flex-row items-center justify-between gap-lg relative overflow-hidden">
<div className="absolute top-0 left-0 w-64 h-64 bg-primary/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
<div className="relative z-10 text-right md:w-1/2">
<h2 className="font-headline-lg text-headline-lg text-on-primary-fixed-variant mb-base">ابقَ على اطلاع بأفضل العروض</h2>
<p className="font-body-lg text-body-lg text-on-primary-container">اشترك في نشرتنا البريدية لتصلك أحدث الصفقات والخصومات الحصرية قبل أي شخص آخر.</p>
</div>
<div className="relative z-10 w-full md:w-[45%] md:max-w-md shrink-0">
<form className="flex flex-col sm:flex-row gap-base">
<input className="flex-grow bg-surface-container-lowest border-none rounded-lg px-md py-3 focus:ring-2 focus:ring-primary font-body-md text-body-md" placeholder="بريدك الإلكتروني" type="email"/>
<button className="bg-primary text-on-primary px-md py-3 rounded-lg font-bold hover:bg-surface-tint transition-all whitespace-nowrap">اشترك الآن</button>
</form>
</div>
</div>
</section>
</main>

<footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant">
<div className="w-full py-lg px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
<div className="flex flex-col md:flex-row justify-between items-start gap-xl mb-xl w-full">
<div className="max-w-md w-full md:w-[420px] shrink-0">
<span className="font-headline-md text-headline-md font-extrabold text-primary dark:text-primary-fixed-dim">سفريات</span>
<p className="text-on-surface-variant mt-sm font-body-md text-body-md">منصتكم الموثوقة لاستكشاف العالم. نقدم حلول سفر متكاملة بأسعار تنافسية وخدمة عملاء على مدار الساعة.</p>
<div className="flex gap-sm mt-md">
<Link className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-primary hover:text-white transition-all" href="/"><span className="material-symbols-outlined" data-icon="share">share</span></Link>
<Link className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-primary hover:text-white transition-all" href="/"><span className="material-symbols-outlined" data-icon="chat">chat</span></Link>
<Link className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-primary hover:text-white transition-all" href="/"><span className="material-symbols-outlined" data-icon="mail">mail</span></Link>
</div>
</div>
<div className="grid grid-cols-2 md:grid-cols-3 gap-xl">
<div>
<h5 className="font-bold mb-md text-on-surface">الشركة</h5>
<ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
<li><Link className="hover:text-primary hover:underline transition-all" href="/">عن سفريات</Link></li>
<li><Link className="hover:text-primary hover:underline transition-all" href="/">الشركاء</Link></li>
<li><Link className="hover:text-primary hover:underline transition-all" href="/">الوظائف</Link></li>
</ul>
</div>
<div>
<h5 className="font-bold mb-md text-on-surface">الدعم</h5>
<ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
<li><Link className="hover:text-primary hover:underline transition-all" href="/support">اتصل بنا</Link></li>
<li><Link className="hover:text-primary hover:underline transition-all" href="/support">الأسئلة الشائعة</Link></li>
<li><Link className="hover:text-primary hover:underline transition-all" href="/support">مركز المساعدة</Link></li>
</ul>
</div>
<div>
<h5 className="font-bold mb-md text-on-surface">قانوني</h5>
<ul className="space-y-sm text-on-surface-variant font-label-md text-label-md">
<li><Link className="hover:text-primary hover:underline transition-all" href="/">سياسة الخصوصية</Link></li>
<li><Link className="hover:text-primary hover:underline transition-all" href="/">الشروط والأحكام</Link></li>
</ul>
</div>
</div>
</div>
<div className="border-t border-outline-variant pt-lg flex flex-col md:flex-row justify-between items-center gap-base">
<p className="text-on-surface-variant font-label-sm text-label-sm">© 2024 سفريات. جميع الحقوق محفوظة.</p>
<div className="flex gap-md opacity-70">
<span className="material-symbols-outlined" data-icon="credit_card">credit_card</span>
<span className="material-symbols-outlined" data-icon="payments">payments</span>
<span className="material-symbols-outlined" data-icon="account_balance">account_balance</span>
</div>
</div>
</div>
</footer>

<nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50">
<div className="flex justify-around items-center h-16">
<Link className="flex flex-col items-center gap-xs text-primary" href="/">
<span className="material-symbols-outlined" data-icon="home" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
<span className="font-label-sm text-label-sm">الرئيسية</span>
</Link>
<Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/hotels">
<span className="material-symbols-outlined" data-icon="explore">explore</span>
<span className="font-label-sm text-label-sm">استكشف</span>
</Link>
<Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/manage-bookings">
<span className="material-symbols-outlined" data-icon="airplane_ticket">airplane_ticket</span>
<span className="font-label-sm text-label-sm">حجوزاتي</span>
</Link>
<Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/user-dashboard">
<span className="material-symbols-outlined" data-icon="person">person</span>
<span className="font-label-sm text-label-sm">حسابي</span>
</Link>
</div>
</nav>
    </>
  );
}
