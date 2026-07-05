import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "حجز فنادق — قارن أسعار الفنادق واحجز بأفضل سعر | Hotel Booking",
  description:
    "احجز فندقك أونلاين مع سفريات. قارن أسعار الفنادق في أشهر الوجهات واحصل على أفضل العروض مع إلغاء مرن ودفع آمن وتأكيد فوري.",
  keywords: [
    "حجز فنادق",
    "حجز فنادق أونلاين",
    "عروض فنادق",
    "أرخص أسعار الفنادق",
    "hotel booking",
    "book hotels online",
    "hotel deals",
  ],
};

export default function HotelsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
