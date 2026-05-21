"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

// Mock hotels data based on Google Stitch high-fidelity specifications + 2 extras for demo
interface Hotel {
  id: number;
  name: string;
  stars: number;
  location: string;
  ratingScore: number;
  ratingText: string;
  reviewsCount: number;
  price: number;
  originalPrice?: number;
  image: string;
  features: string[];
  amenities: { wifi: boolean; pool: boolean; parking: boolean };
  tag?: string;
  tagType?: "danger" | "tertiary" | "success" | "luxury" | "promo";
}

const initialHotels: Hotel[] = [
  {
    id: 1,
    name: "فندق ريتز كارلتون الفاخر",
    stars: 5,
    location: "وسط المدينة، دبي - على بعد 2 كم من المركز",
    ratingScore: 4.8,
    ratingText: "ممتاز",
    reviewsCount: 1240,
    price: 950,
    originalPrice: 1200,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCxkqX9rrxNd1WcQ_PzDOhuKWlr7-FlDuQRKBQH7dQQNe6JJKB1OJ1Q27nKikkQkakQw0sjX_ht0PL2wc4op-FQsIPFgdGeiyDJOVna2qJ3Q34tKXH0ahSqTdTMBo9VLq8-3is9diijdNYGahWIzwcud-yvC0HHTQPjQz2EtWiTXxl8bHHVubqnOhntNPsW3bqe7qbLKMkzvGteCvrrbm0eMmkH-hWjorZYHd-crcreZW-_gb2mqwLUecSw6qqIo1YJaiEbTYrJ842K",
    features: ["مسبح خارجي", "واي فاي مجاني", "إلغاء مجاني"],
    amenities: { wifi: true, pool: true, parking: false },
    tag: "لم يتبق سوى غرفتين!",
    tagType: "danger",
  },
  {
    id: 2,
    name: "منتجع النسيم الهادئ",
    stars: 4,
    location: "جميرا، دبي - إطلالة بحرية",
    ratingScore: 4.5,
    ratingText: "رائع",
    reviewsCount: 850,
    price: 720,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAwP2rrLb0pySH36_sTDenmLw-titkhCq7osLc29gS7UO7bCGid0PI3Bw6HnQcbkThFTQI4QcUY82H6TIhMNa8cPEq6kL50TeoXF9aFTtnsSS5TaEzwMZorG3n56AFiVU6lKob5Q4pgt0rvuchCi-eQ14YjBggRNwhURqR36Urn-8heXHzqtk2LW447pH6VKR7cl-Dd91s5-Ustv8ve-Ipl3AgGMm3RmvCB75_XvBydGUutUJdPEMLqe92G5TLklRjQ6LX2z4lNKj_3",
    features: ["شامل الإفطار", "مسبح", "موقف سيارات"],
    amenities: { wifi: false, pool: true, parking: true },
    tag: "الأكثر مبيعاً",
    tagType: "tertiary",
  },
  {
    id: 3,
    name: "فندق سيتي لايف",
    stars: 3,
    location: "منطقة الأعمال، دبي",
    ratingScore: 4.2,
    ratingText: "جيد جداً",
    reviewsCount: 2100,
    price: 450,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDvSArC88L3IWgLBF3Dkm20uyY0Zev-JXkjMGWC9eiWPvXgsJe1ccNKGIFH7prNeyKrGk1InvEpFXyoyNIP88b8KNF9BmD0jiZdF-LNeXp6DVYSue72-pVrT-CqwtM4NDh9FPPhfB35lLx_ECiUUsw47EHZjIzUUToWGDgq-jpvkPpMnqPS7BfeC3mZMU4ZLZw0qpPwkkHK3AMWtA0nYBTZnCHUWLbboA26CLfV8iRtN4634UmBo0bTqavuCDLYGM14jq5If4Yvba-R",
    features: ["سعر اقتصادي", "واي فاي مجاني", "موقف سيارات"],
    amenities: { wifi: true, pool: false, parking: true },
    tag: "سعر اقتصادي",
    tagType: "success",
  },
  {
    id: 4,
    name: "منتجع المها الصحراوي الفخم",
    stars: 5,
    location: "صحراء دبي - تجربة بدوية فريدة",
    ratingScore: 4.9,
    ratingText: "استثنائي",
    reviewsCount: 640,
    price: 2400,
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80",
    features: ["مسبح خاص لكل فيلا", "واي فاي مجاني", "شامل جميع الوجبات"],
    amenities: { wifi: true, pool: true, parking: true },
    tag: "تجربة فاخرة",
    tagType: "luxury",
  },
  {
    id: 5,
    name: "فندق الشاطئ الأزرق",
    stars: 4,
    location: "مرسى دبي - إطلالة على المارينا",
    ratingScore: 4.3,
    ratingText: "ممتاز",
    reviewsCount: 980,
    price: 580,
    image: "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?auto=format&fit=crop&w=800&q=80",
    features: ["إطلالة بحرية", "واي فاي مجاني", "مسبح خارجي"],
    amenities: { wifi: true, pool: true, parking: false },
    tag: "عرض خاص",
    tagType: "promo",
  },
  {
    id: 6,
    name: "فندق برج الرافال كمبينسكي",
    stars: 5,
    location: "الصحافة، الرياض - موقع مميز شمال المدينة",
    ratingScore: 4.7,
    ratingText: "ممتاز",
    reviewsCount: 1420,
    price: 1100,
    originalPrice: 1350,
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80",
    features: ["مسبح خارجي", "إلغاء مجاني", "موقف سيارات مجاني"],
    amenities: { wifi: true, pool: true, parking: true },
    tag: "خصم خاص عائلي",
    tagType: "success",
  },
  {
    id: 7,
    name: "فندق قصر الحمراء الأثري",
    stars: 5,
    location: "شارع كورنيش جدة، جدة",
    ratingScore: 4.6,
    ratingText: "رائع",
    reviewsCount: 890,
    price: 850,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    features: ["شامل الإفطار", "إلغاء مجاني", "مطل على البحر"],
    amenities: { wifi: true, pool: true, parking: true },
    tag: "إطلالة ساحرة",
    tagType: "luxury",
  },
  {
    id: 8,
    name: "فندق النيل بلازا المتميز",
    stars: 4,
    location: "جاردن سيتي، القاهرة",
    ratingScore: 4.4,
    ratingText: "رائع",
    reviewsCount: 1720,
    price: 380,
    image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80",
    features: ["مطل على النيل", "واي فاي مجاني", "قريب من المعالم"],
    amenities: { wifi: true, pool: false, parking: false },
    tag: "الأكثر شعبية بمصر",
    tagType: "tertiary",
  },
  {
    id: 9,
    name: "فندق أجنحة الخليج الهادئة",
    stars: 3,
    location: "الجفير، المنامة - موقع سياحي مميز",
    ratingScore: 4.0,
    ratingText: "جيد جداً",
    reviewsCount: 920,
    price: 290,
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80",
    features: ["سعر اقتصادي", "موقف سيارات مجاني", "مطبخ متكامل"],
    amenities: { wifi: true, pool: false, parking: true },
    tag: "قيمة ممتازة",
    tagType: "success",
  },
  {
    id: 10,
    name: "منتجع فور سيزونز هافن",
    stars: 5,
    location: "جزيرة نخلة جميرا، دبي",
    ratingScore: 4.9,
    ratingText: "استثنائي",
    reviewsCount: 1530,
    price: 2100,
    originalPrice: 2600,
    image: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=800&q=80",
    features: ["شاطئ خاص", "شامل الإفطار", "مسبح إنفينيتي"],
    amenities: { wifi: true, pool: true, parking: true },
    tag: "عرض محدود اليوم!",
    tagType: "danger",
  },
  {
    id: 11,
    name: "فندق شيراتون بوابة الرياض",
    stars: 4,
    location: "وسط المدينة، الرياض - قرب حي السفارات",
    ratingScore: 4.5,
    ratingText: "رائع",
    reviewsCount: 1100,
    price: 640,
    image: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=800&q=80",
    features: ["مركز للياقة البدنية", "واي فاي مجاني", "موقف سيارات"],
    amenities: { wifi: true, pool: true, parking: true },
    tag: "مناسب لرجال الأعمال",
    tagType: "promo",
  },
  {
    id: 12,
    name: "فندق جاردن سيتي بيتش",
    stars: 3,
    location: "الحمراء، جدة - قرب نافورة جدة",
    ratingScore: 4.1,
    ratingText: "جيد جداً",
    reviewsCount: 740,
    price: 320,
    image: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80",
    features: ["واي فاي مجاني", "موقف سيارات", "إلغاء مجاني"],
    amenities: { wifi: true, pool: false, parking: true },
    tag: "سعر منافس",
    tagType: "success",
  },
];

export default function HotelsPage() {
  // Search state variables
  const [destination, setDestination] = useState("دبي، الإمارات العربية المتحدة");
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  
  // Date Picker States
  const [checkIn, setCheckIn] = useState("2026-12-15");
  const [checkOut, setCheckOut] = useState("2026-12-20");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Guest & Room States
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);

  // Search execution trigger state (filters are immediately reactive, but we can lock search criteria)
  const [searchQuery, setSearchQuery] = useState({
    destination: "دبي، الإمارات العربية المتحدة",
    checkIn: "2026-12-15",
    checkOut: "2026-12-20",
    guestsText: "2 بالغين، 1 غرفة",
  });

  // Filter state variables
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [starRatings, setStarRatings] = useState<number[]>([]);
  const [amenities, setAmenities] = useState({
    wifi: false,
    pool: false,
    parking: false,
  });

  // Sorting
  const [sortBy, setSortBy] = useState("الأكثر رواجاً");

  // Favorites
  const [favorites, setFavorites] = useState<number[]>([]);

  // Layout switcher
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Simulated Autocomplete suggestions
  const destinations = [
    "دبي، الإمارات العربية المتحدة",
    "الرياض، المملكة العربية السعودية",
    "جدة، المملكة العربية السعودية",
    "القاهرة، مصر",
    "المنامة، البحرين",
  ];

  // Map simulated pin hover/click popup details
  const [selectedMapHotel, setSelectedMapHotel] = useState<Hotel | null>(null);

  // Filter & sort logic
  const filteredHotels = useMemo(() => {
    let result = [...initialHotels];

    // Filter by destination search query (simple mock match)
    if (searchQuery.destination) {
      const q = searchQuery.destination.toLowerCase();
      result = result.filter(
        (h) =>
          h.location.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q)
      );
    }

    // Filter by price
    result = result.filter((h) => h.price <= maxPrice);

    // Filter by stars
    if (starRatings.length > 0) {
      result = result.filter((h) => starRatings.includes(h.stars));
    }

    // Filter by amenities
    if (amenities.wifi) {
      result = result.filter((h) => h.amenities.wifi);
    }
    if (amenities.pool) {
      result = result.filter((h) => h.amenities.pool);
    }
    if (amenities.parking) {
      result = result.filter((h) => h.amenities.parking);
    }

    // Sorting logic
    if (sortBy === "السعر: من الأقل للأعلى") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "السعر: من الأعلى للأقل") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "تقييم الضيوف") {
      result.sort((a, b) => b.ratingScore - a.ratingScore);
    }

    return result;
  }, [searchQuery, maxPrice, starRatings, amenities, sortBy]);

  // Total rating calculation
  const formattedCheckInDate = useMemo(() => {
    if (!checkIn) return "اختر تاريخاً";
    const d = new Date(checkIn);
    return `${d.getDate()} - ${d.getMonth() + 1} ديسمبر`;
  }, [checkIn]);

  // Handlers
  const handleSearchSubmit = () => {
    setSearchQuery({
      destination,
      checkIn,
      checkOut,
      guestsText: `${adults} بالغين، ${rooms} غرفة`,
    });
    setShowDestDropdown(false);
    setShowDatePicker(false);
    setShowGuestDropdown(false);
  };

  const toggleStarRating = (stars: number) => {
    setStarRatings((prev) =>
      prev.includes(stars)
        ? prev.filter((s) => s !== stars)
        : [...prev, stars]
    );
  };

  const toggleAmenity = (key: "wifi" | "pool" | "parking") => {
    setAmenities((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleClearFilters = () => {
    setMaxPrice(5000);
    setStarRatings([]);
    setAmenities({ wifi: false, pool: false, parking: false });
  };

  const toggleFavorite = (id: number) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
  };

  // Close dropdowns on body click helper
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".search-input-container")) {
        setShowDestDropdown(false);
      }
      if (!target.closest(".date-picker-container")) {
        setShowDatePicker(false);
      }
      if (!target.closest(".guest-dropdown-container")) {
        setShowGuestDropdown(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  return (
    <div className="safariyat min-h-screen bg-background text-on-background relative pb-16 md:pb-0">
      
      {/* Top Navigation Bar */}
      <header className="bg-surface-container-lowest dark:bg-inverse-surface shadow-sm sticky top-0 z-50 transition-all duration-300">
        <nav className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-16">
          <div className="flex items-center gap-lg">
            <Link className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary dark:text-inverse-primary" href="/">
              سفريات
            </Link>
            <div className="hidden md:flex gap-md items-center">
              <Link className="text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/">
                رحلات طيران
              </Link>
              <Link className="text-primary dark:text-inverse-primary font-bold border-b-2 border-primary dark:border-inverse-primary pb-1 font-label-md text-label-md" href="/hotels">
                فنادق
              </Link>
              <Link className="text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/#offers">
                عروض
              </Link>
              <Link className="text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors font-label-md text-label-md" href="/manage-bookings">
                رحلاتي
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-sm">
            <div className="hidden md:flex items-center gap-sm mr-md text-outline">
              <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors p-2 hover:bg-surface-container rounded-full" data-icon="language">language</span>
              <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors p-2 hover:bg-surface-container rounded-full" data-icon="currency_exchange">currency_exchange</span>
              <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors p-2 hover:bg-surface-container rounded-full" data-icon="notifications">notifications</span>
            </div>
            <Link href="/signin" className="bg-primary text-on-primary px-md py-2 rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all">
              تسجيل الدخول
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Search Area */}
      <section className="bg-primary pt-md pb-lg px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-headline-lg text-headline-lg text-on-primary mb-md">ابحث عن ملاذك القادم في أي مكان في العالم</h1>
          
          {/* Floating Search Bar Container */}
          <div className="bg-surface-container-lowest p-xs rounded-xl shadow-xl flex flex-col md:flex-row items-stretch gap-xs md:gap-0 relative z-40">
            
            {/* Destination Input */}
            <div className="flex-1 flex items-center border-b md:border-b-0 md:border-l border-outline-variant p-sm relative search-input-container">
              <span className="material-symbols-outlined text-primary ml-xs" data-icon="location_on">location_on</span>
              <div className="flex flex-col flex-1">
                <span className="font-label-sm text-label-sm text-outline uppercase select-none">الوجهة</span>
                <input
                  className="bg-transparent border-none focus:outline-none focus:ring-0 font-body-md text-body-md text-on-surface w-full p-0 mt-0.5 placeholder-outline-variant"
                  placeholder="أين تريد الذهاب؟"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onFocus={() => setShowDestDropdown(true)}
                />
              </div>

              {/* Destination Autocomplete Suggestions */}
              {showDestDropdown && (
                <div className="absolute top-[100%] right-0 left-0 mt-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl p-sm z-50">
                  <div className="text-label-sm text-outline px-sm py-xs border-b border-outline-variant/30 mb-xs">الوجهات المقترحة</div>
                  {destinations.map((dest) => (
                    <button
                      key={dest}
                      onClick={() => {
                        setDestination(dest);
                        setShowDestDropdown(false);
                      }}
                      className="w-full text-right px-sm py-2 hover:bg-surface-container-low rounded-lg transition-colors font-body-md text-on-surface flex items-center gap-xs"
                    >
                      <span className="material-symbols-outlined text-outline text-md">location_on</span>
                      {dest}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dates Inputs */}
            <div className="flex-1 flex items-center border-b md:border-b-0 md:border-l border-outline-variant p-sm relative date-picker-container cursor-pointer select-none" onClick={() => setShowDatePicker(!showDatePicker)}>
              <span className="material-symbols-outlined text-primary ml-xs" data-icon="calendar_month">calendar_month</span>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase">التواريخ</span>
                <span className="font-body-md text-body-md text-on-surface mt-0.5">{formattedCheckInDate}</span>
              </div>

              {/* Interactive Dates Dropdown */}
              {showDatePicker && (
                <div className="absolute top-[100%] right-0 left-0 mt-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl p-md z-50 min-w-[280px]" onClick={(e) => e.stopPropagation()}>
                  <div className="font-title-lg text-title-lg text-primary mb-md text-right">اختر تواريخ رحلتك</div>
                  <div className="space-y-md">
                    <div className="flex flex-col gap-xs">
                      <label className="font-label-sm text-label-sm text-outline text-right">تاريخ الدخول</label>
                      <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-sm text-on-surface text-right"
                      />
                    </div>
                    <div className="flex flex-col gap-xs">
                      <label className="font-label-sm text-label-sm text-outline text-right">تاريخ المغادرة</label>
                      <input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-sm text-on-surface text-right"
                      />
                    </div>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="w-full bg-primary text-on-primary py-2 rounded-lg font-label-md"
                    >
                      تأكيد التواريخ
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Guests Input */}
            <div className="flex-1 flex items-center p-sm relative guest-dropdown-container cursor-pointer select-none" onClick={() => setShowGuestDropdown(!showGuestDropdown)}>
              <span className="material-symbols-outlined text-primary ml-xs" data-icon="group">group</span>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase">المسافرون</span>
                <span className="font-body-md text-body-md text-on-surface mt-0.5">{adults} بالغين، {rooms} غرفة</span>
              </div>

              {/* Interactive Guests Count Dropdown */}
              {showGuestDropdown && (
                <div className="absolute top-[100%] right-0 left-0 mt-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl p-md z-50 min-w-[260px]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center py-sm border-b border-outline-variant/30">
                    <span className="font-title-lg text-on-surface">البالغين</span>
                    <div className="flex items-center gap-md">
                      <button
                        onClick={() => adults > 1 && setAdults(adults - 1)}
                        className="w-8 h-8 rounded-full border border-outline-variant text-outline flex items-center justify-center font-bold hover:border-primary hover:text-primary transition-colors"
                      >
                        -
                      </button>
                      <span className="font-title-lg text-on-surface min-w-[20px] text-center">{adults}</span>
                      <button
                        onClick={() => setAdults(adults + 1)}
                        className="w-8 h-8 rounded-full border border-outline-variant text-outline flex items-center justify-center font-bold hover:border-primary hover:text-primary transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-sm">
                    <span className="font-title-lg text-on-surface">الغرف</span>
                    <div className="flex items-center gap-md">
                      <button
                        onClick={() => rooms > 1 && setRooms(rooms - 1)}
                        className="w-8 h-8 rounded-full border border-outline-variant text-outline flex items-center justify-center font-bold hover:border-primary hover:text-primary transition-colors"
                      >
                        -
                      </button>
                      <span className="font-title-lg text-on-surface min-w-[20px] text-center">{rooms}</span>
                      <button
                        onClick={() => setRooms(rooms + 1)}
                        className="w-8 h-8 rounded-full border border-outline-variant text-outline flex items-center justify-center font-bold hover:border-primary hover:text-primary transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGuestDropdown(false)}
                    className="w-full bg-primary text-on-primary py-2 rounded-lg font-label-md mt-sm"
                  >
                    موافق
                  </button>
                </div>
              )}
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearchSubmit}
              className="bg-tertiary text-on-tertiary px-lg py-2.5 rounded-lg font-title-lg text-title-md hover:bg-tertiary-container transition-colors m-xs flex items-center justify-center gap-xs active:scale-[0.98]"
            >
              <span className="material-symbols-outlined" data-icon="search">search</span>
              بحث
            </button>
          </div>
        </div>
      </section>

      {/* Main Layout Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-md grid grid-cols-1 md:grid-cols-12 gap-md">
        
        {/* Sidebar Filters */}
        <aside className="md:col-span-3 space-y-md">
          <div className="bg-surface-container-lowest p-sm rounded-xl shadow-sm border border-outline-variant">
            
            <div className="flex justify-between items-center mb-sm">
              <h3 className="font-label-md text-label-md font-bold">تصفية النتائج</h3>
              <button onClick={handleClearFilters} className="text-primary hover:underline font-label-sm text-label-sm">
                مسح الكل
              </button>
            </div>

            {/* Price Range Slider */}
            <div className="mb-md border-b border-outline-variant/30 pb-sm">
              <label className="font-label-sm text-label-sm block mb-xs">نطاق السعر (ليلة واحدة)</label>
              <div className="flex justify-between text-label-sm mb-xs text-outline font-bold">
                <span>0 ر.س</span>
                <span>{maxPrice === 5000 ? "5000+ ر.س" : `${maxPrice} ر.س`}</span>
              </div>
              <input
                className="w-full h-1 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
                type="range"
                min="100"
                max="5000"
                step="50"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
              />
            </div>

            {/* Star Rating Checkboxes */}
            <div className="mb-md border-b border-outline-variant/30 pb-sm">
              <label className="font-label-sm text-label-sm block mb-xs">تصنيف النجوم</label>
              <div className="space-y-sm">
                {[5, 4, 3].map((star) => (
                  <label key={star} className="flex items-center gap-sm cursor-pointer group select-none">
                    <input
                      className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary"
                      type="checkbox"
                      checked={starRatings.includes(star)}
                      onChange={() => toggleStarRating(star)}
                    />
                    <div className="flex text-tertiary">
                      {Array.from({ length: star }).map((_, i) => (
                        <span key={i} className="material-symbols-outlined text-sm" data-icon="star" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      ))}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Amenities Checkboxes */}
            <div className="mb-xs">
              <label className="font-label-sm text-label-sm block mb-xs">المرافق</label>
              <div className="space-y-sm">
                <label className="flex items-center gap-sm cursor-pointer select-none">
                  <input
                    className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary"
                    type="checkbox"
                    checked={amenities.wifi}
                    onChange={() => toggleAmenity("wifi")}
                  />
                  <span className="text-on-surface-variant font-label-md">واي فاي مجاني</span>
                </label>
                <label className="flex items-center gap-sm cursor-pointer select-none">
                  <input
                    className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary"
                    type="checkbox"
                    checked={amenities.pool}
                    onChange={() => toggleAmenity("pool")}
                  />
                  <span className="text-on-surface-variant font-label-md">مسبح</span>
                </label>
                <label className="flex items-center gap-sm cursor-pointer select-none">
                  <input
                    className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary"
                    type="checkbox"
                    checked={amenities.parking}
                    onChange={() => toggleAmenity("parking")}
                  />
                  <span className="text-on-surface-variant font-label-md">موقف سيارات</span>
                </label>
              </div>
            </div>
          </div>

          {/* Ad/Promo Card */}
          <div className="relative rounded-xl overflow-hidden h-56 shadow-lg group cursor-pointer border border-outline-variant/30">
            <img
              alt="Special Offer"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6pzKwIpI-ehT8HGPxk1fKxdLcyeAVwkgo061mTDZZBpK-WKg3sA1AWbfkkEQvE5nykNIswt6Fr-7ZcdUD3LMNb5J94F_pS1Vc_ce1XX0k1XtVyWHC48B_jisLpWm8XCz86EMr0k2pwslYbM1rpQRYfpuXjCh8q_iq7Qv7K9Gsn5U_OUaOo7b2Bgp342VxF9zSqXvTOlO0Jiq7aSkNcNXEl94RKzwEoxeEUB6xiwH9xvSQarYees4ehLhX6bX3MqTAAxXnE9qe5RjN"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent flex flex-col justify-end p-sm text-on-primary">
              <span className="bg-tertiary text-on-tertiary px-sm py-0.5 rounded text-label-sm w-fit mb-xs">خصم 25%</span>
              <h4 className="font-title-lg text-title-lg leading-tight mb-xs">الفنادق المختارة في دبي</h4>
              <p className="font-body-md text-body-md opacity-90">احجز الآن ووفّر أكثر</p>
            </div>
          </div>
        </aside>

        {/* Main Content: Hotel Results */}
        <div className="md:col-span-9">
          
          {/* Toolbar */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-md gap-sm bg-surface-container-low p-2 rounded-xl border border-outline-variant/20">
            <p className="font-label-md text-label-md text-on-surface">
              تم العثور على <span className="text-primary font-bold">{filteredHotels.length}</span> فندقاً
            </p>
            <div className="flex items-center gap-md">
              <div className="flex bg-surface-container-highest p-1 rounded-lg">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-md py-1.5 rounded-md font-label-md transition-all ${
                    viewMode === "list"
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  قائمة
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`px-md py-1.5 rounded-md font-label-md transition-all ${
                    viewMode === "map"
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  خريطة
                </button>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant rounded-lg p-sm font-label-md focus:ring-primary focus:outline-none"
              >
                <option>الأكثر رواجاً</option>
                <option>السعر: من الأقل للأعلى</option>
                <option>السعر: من الأعلى للأقل</option>
                <option>تقييم الضيوف</option>
              </select>
            </div>
          </div>

          {viewMode === "list" ? (
            /* Hotel List (Bento Cards) */
            <div className="space-y-md">
              {filteredHotels.map((hotel) => (
                <div
                  key={hotel.id}
                  className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden flex flex-col md:flex-row transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 animate-fade-in"
                >
                  <div className="md:w-60 h-48 md:h-auto relative overflow-hidden shrink-0">
                    <img alt={hotel.name} className="w-full h-full object-cover" src={hotel.image} />
                    <button
                      onClick={() => toggleFavorite(hotel.id)}
                      className="absolute top-sm right-sm bg-surface-container-lowest/80 backdrop-blur p-sm rounded-full text-primary hover:bg-primary hover:text-on-primary transition-colors focus:outline-none"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontVariationSettings: favorites.includes(hotel.id)
                            ? "'FILL' 1"
                            : "'FILL' 0",
                        }}
                      >
                        favorite
                      </span>
                    </button>
                    {hotel.tag && (
                      <div
                        className={`absolute top-sm left-sm px-sm py-1 rounded text-label-sm font-bold text-white shadow-sm ${
                          hotel.tagType === "danger"
                            ? "bg-error"
                            : hotel.tagType === "tertiary"
                            ? "bg-tertiary"
                            : hotel.tagType === "success"
                            ? "bg-primary"
                            : hotel.tagType === "luxury"
                            ? "bg-indigo-700"
                            : "bg-teal-600"
                        }`}
                      >
                        {hotel.tag}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-grow p-sm md:p-md flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-xs">
                        <div>
                          <h2 className="font-title-lg text-title-lg text-on-surface mb-0.5">{hotel.name}</h2>
                          <div className="flex items-center gap-xs text-tertiary mb-0.5">
                            {Array.from({ length: hotel.stars }).map((_, i) => (
                              <span
                                key={i}
                                className="material-symbols-outlined text-sm"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                star
                              </span>
                            ))}
                            <span className="text-on-surface-variant text-label-sm mr-sm">فندق {hotel.stars} نجوم</span>
                          </div>
                          <div className="flex items-center gap-xs text-outline font-label-sm">
                            <span className="material-symbols-outlined text-md">location_on</span>
                            {hotel.location}
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-xs mb-xs">
                            <div className="text-right">
                              <p className="font-label-md text-label-md font-bold text-on-surface">{hotel.ratingText}</p>
                              <p className="text-label-sm text-outline">{hotel.reviewsCount} تقييم</p>
                            </div>
                            <div className="bg-primary text-on-primary w-10 h-10 flex items-center justify-center rounded-lg font-bold text-title-lg shadow-sm">
                              {hotel.ratingScore.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-xs mt-sm">
                        {hotel.features.map((feature, idx) => (
                          <span
                            key={idx}
                            className={`px-sm py-1 rounded-full text-label-sm flex items-center gap-xs ${
                              feature.includes("إلغاء مجاني") || feature.includes("شامل جميع الوجبات")
                                ? "bg-secondary-container text-on-secondary-container font-medium"
                                : "bg-surface-container-high text-on-surface-variant"
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {feature.includes("مسبح")
                                ? "pool"
                                : feature.includes("واي فاي")
                                ? "wifi"
                                : feature.includes("إلغاء")
                                ? "check_circle"
                                : feature.includes("الإفطار")
                                ? "restaurant"
                                : "local_activity"}
                            </span>
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-sm pt-xs border-t border-outline-variant">
                      <div>
                        {hotel.id === 1 && <p className="text-label-sm text-error mb-xs font-bold">لم يتبق سوى غرفتين!</p>}
                        <p className="font-label-md text-on-surface-variant">الخيار الأفضل للمسافرين</p>
                      </div>
                      <div className="text-left flex flex-col items-end">
                        {hotel.originalPrice && (
                          <span className="text-label-sm text-outline line-through mb-0.5">{hotel.originalPrice} ر.س</span>
                        )}
                        <div className="flex items-baseline gap-xs">
                          <span className="font-headline-md text-headline-md text-tertiary">{hotel.price}</span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">ر.س / ليلة</span>
                        </div>
                        <Link href="/hotels/details" className="bg-primary text-on-primary px-md py-1.5 rounded-lg font-label-md mt-xs hover:opacity-90 active:scale-95 transition-all text-center min-w-[100px] block">
                          عرض الغرف
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredHotels.length === 0 && (
                <div className="text-center py-xl bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
                  <span className="material-symbols-outlined text-xl text-outline mb-md" style={{ fontSize: "48px" }}>search_off</span>
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">لم نجد أي فنادق تطابق خيارات الفلترة</h3>
                  <p className="text-on-surface-variant font-body-md">يرجى تعديل خيارات التصفية أو السعر لإظهار نتائج جديدة</p>
                </div>
              )}
            </div>
          ) : (
            /* Premium Interactive Dark Map View */
            <div className="relative w-full h-[600px] bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl overflow-hidden border border-outline-variant shadow-2xl flex items-center justify-center">
              
              {/* Grid backdrop for simulated topographic look */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-30"></div>
              
              {/* Map simulated elements */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[80%] h-[80%] border-2 border-primary/10 rounded-full animate-[ping_10s_infinite]"></div>
                <div className="w-[50%] h-[50%] border border-primary/20 rounded-full absolute animate-[ping_7s_infinite]"></div>
              </div>

              {/* Map Glowing Pins */}
              {filteredHotels.map((hotel, idx) => {
                const positions = [
                  { top: "35%", right: "25%" },
                  { top: "55%", right: "45%" },
                  { top: "25%", right: "60%" },
                  { top: "70%", right: "75%" },
                  { top: "45%", right: "80%" },
                ];
                const pos = positions[idx % positions.length];
                const isSelected = selectedMapHotel?.id === hotel.id;

                return (
                  <div
                    key={hotel.id}
                    className="absolute z-20"
                    style={{ top: pos.top, right: pos.right }}
                  >
                    <button
                      onClick={() => setSelectedMapHotel(hotel)}
                      className={`relative flex flex-col items-center group cursor-pointer`}
                    >
                      <div className={`px-sm py-1 bg-primary text-on-primary rounded-full shadow-2xl font-bold text-label-sm border transition-all ${
                        isSelected ? "scale-110 border-white bg-tertiary" : "border-primary/20 hover:scale-105"
                      }`}>
                        {hotel.price} ر.س
                      </div>
                      
                      <div className="relative flex items-center justify-center mt-1">
                        <span className={`material-symbols-outlined text-xl transition-colors ${
                          isSelected ? "text-tertiary" : "text-primary"
                        }`} style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                        <div className="absolute w-6 h-6 bg-primary/20 rounded-full -z-10 animate-ping"></div>
                      </div>
                    </button>
                  </div>
                );
              })}

              {/* Selected Hotel Popup Detail Container */}
              {selectedMapHotel && (
                <div className="absolute bottom-4 right-4 left-4 md:right-auto md:left-4 md:w-80 bg-surface-container-lowest border border-outline-variant p-sm rounded-xl shadow-2xl z-30 animate-fade-in flex gap-sm">
                  <img src={selectedMapHotel.image} alt={selectedMapHotel.name} className="w-20 h-20 object-cover rounded-lg shrink-0" />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-body-md text-body-md font-bold text-on-surface line-clamp-1">{selectedMapHotel.name}</h4>
                        <button onClick={() => setSelectedMapHotel(null)} className="text-outline hover:text-primary">
                          <span className="material-symbols-outlined text-md">close</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-xs text-tertiary text-sm mt-0.5">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-on-surface-variant text-label-sm">{selectedMapHotel.ratingScore} ممتاز</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-xs">
                      <div className="text-right">
                        <span className="font-bold text-primary text-title-lg">{selectedMapHotel.price} ر.س</span>
                        <span className="text-label-sm text-outline"> / ليلة</span>
                      </div>
                      <Link href="/hotels/details" className="bg-primary text-on-primary px-md py-1 rounded-lg text-label-sm hover:opacity-90 font-medium">
                        احجز الآن
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating map guide */}
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-sm py-1.5 rounded-lg text-white font-label-sm flex items-center gap-xs select-none">
                <span className="material-symbols-outlined text-sm">info</span>
                انقر على الدبابيس لإظهار تفاصيل الفندق
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-center items-center gap-sm mt-xl">
            <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-outline hover:border-primary hover:text-primary transition-colors focus:outline-none">
              <span className="material-symbols-outlined" data-icon="chevron_right">chevron_right</span>
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-on-primary font-bold shadow-sm">1</button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors focus:outline-none">2</button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors focus:outline-none">3</button>
            <span className="text-outline mx-xs">...</span>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors focus:outline-none">24</button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant text-outline hover:border-primary hover:text-primary transition-colors focus:outline-none">
              <span className="material-symbols-outlined" data-icon="chevron_left">chevron_left</span>
            </button>
          </div>

        </div>
      </main>

      {/* Map View Floating Action Button for mobile devices */}
      {viewMode === "list" ? (
        <button
          onClick={() => setViewMode("map")}
          className="fixed bottom-lg left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-xl py-md rounded-full shadow-2xl flex items-center gap-sm z-40 md:hidden font-title-lg hover:scale-105 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined" data-icon="map">map</span>
          عرض الخريطة
        </button>
      ) : (
        <button
          onClick={() => setViewMode("list")}
          className="fixed bottom-lg left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-xl py-md rounded-full shadow-2xl flex items-center gap-sm z-40 md:hidden font-title-lg hover:scale-105 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined" data-icon="list">list</span>
          عرض القائمة
        </button>
      )}

      {/* Footer */}
      <footer className="bg-surface-container dark:bg-surface-dim border-t border-outline-variant mt-xl">
        <div className="w-full py-lg px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <div className="flex flex-col md:items-start items-center gap-sm">
            <Link className="font-headline-md text-headline-md font-extrabold text-primary dark:text-primary-fixed-dim" href="/">
              سفريات
            </Link>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md md:max-w-xl text-center md:text-right">
              وجهتك الأولى لتخطيط رحلات العمر بأفضل الأسعار وأعلى مستويات الخدمة.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-md my-lg md:my-0">
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="/">
              عن سفريات
            </Link>
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="/">
              سياسة الخصوصية
            </Link>
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="/">
              الشروط والأحكام
            </Link>
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="/support">
              اتصل بنا
            </Link>
            <Link className="text-on-surface-variant font-label-sm text-label-sm hover:text-primary hover:underline transition-opacity" href="/support">
              الأسئلة الشائعة
            </Link>
          </div>
          <div className="flex flex-col items-center md:items-end gap-sm text-outline">
            <div className="flex gap-md">
              <span className="material-symbols-outlined cursor-pointer hover:text-primary" data-icon="public">public</span>
              <span className="material-symbols-outlined cursor-pointer hover:text-primary" data-icon="share">share</span>
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant opacity-80">© 2026 سفريات. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>

      {/* Bottom Nav Bar for Mobile Devices */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-outline-variant/30 z-50">
        <div className="flex justify-around items-center h-16">
          <Link className="flex flex-col items-center gap-xs text-on-surface-variant" href="/">
            <span className="material-symbols-outlined" data-icon="home">home</span>
            <span className="font-label-sm text-label-sm">الرئيسية</span>
          </Link>
          <Link className="flex flex-col items-center gap-xs text-primary" href="/hotels">
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

    </div>
  );
}
