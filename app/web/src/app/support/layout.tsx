import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الدعم والمساعدة — الأسئلة الشائعة",
  description:
    "مركز مساعدة سفريات: الأسئلة الشائعة حول حجز الطيران والفنادق، الإلغاء والاسترداد، الدفع، وإدارة الحجوزات. تواصل مع فريق الدعم على مدار الساعة.",
};

export default function SupportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
