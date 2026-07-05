import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "حجز طيران — ابحث وقارن أسعار تذاكر الطيران | Flight Booking",
  description:
    "ابحث عن رحلات الطيران وقارن الأسعار من مئات شركات الطيران واحجز أرخص تذكرة طيران أونلاين مع سفريات. رحلات ذهاب وعودة أو ذهاب فقط، دفع آمن وتأكيد فوري.",
  keywords: [
    "حجز طيران",
    "حجز تذاكر طيران أونلاين",
    "رحلات طيران رخيصة",
    "أرخص تذاكر الطيران",
    "مقارنة أسعار الطيران",
    "flight booking",
    "cheap flights",
    "book flights online",
  ],
};

export default function FlightsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
