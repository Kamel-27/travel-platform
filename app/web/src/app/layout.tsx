import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "سفريات | Safariyat - وجهتك الأولى للسفر",
  description: "شريكك الموثوق لاستكشاف العالم بكل سهولة وراحة. حجز طيران وفنادق بأفضل الأسعار.",
  keywords: "سفريات, Safariyat, طيران, فنادق, حجز, travel, B2B, flights, hotels, booking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="safariyat min-h-screen bg-background text-on-surface">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
