import type { Metadata } from "next";
import "./globals.css";
import { materialSymbols, sansArabic } from "./fonts";
import { AuthProvider } from "@/lib/auth-context";

const SITE_URL = "https://www.safariyat.live";
const SITE_NAME = "سفريات | Safariyat";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "سفريات — حجز طيران وفنادق أونلاين بأفضل الأسعار | Safariyat",
    template: "%s | سفريات Safariyat",
  },
  description:
    "سفريات (Safariyat) منصة عربية لحجز تذاكر الطيران والفنادق أونلاين. قارن أسعار رحلات الطيران من مئات شركات الطيران، واحجز فندقك بأفضل سعر مع دفع آمن وتأكيد فوري وخدمة عملاء على مدار الساعة.",
  keywords: [
    "سفريات",
    "Safariyat",
    "Safriyat",
    "حجز طيران",
    "حجز تذاكر طيران",
    "رحلات طيران رخيصة",
    "حجز فنادق",
    "أرخص تذاكر الطيران",
    "عروض سفر",
    "flight booking",
    "book flights online",
    "cheap flights",
    "hotel booking",
    "online travel agency",
  ],
  alternates: {
    canonical: "./",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ar_EG",
    title: "سفريات — حجز طيران وفنادق أونلاين بأفضل الأسعار",
    description:
      "قارن أسعار رحلات الطيران واحجز تذاكرك وفنادقك أونلاين مع سفريات. دفع آمن، تأكيد فوري، ودعم على مدار الساعة.",
  },
  twitter: {
    card: "summary",
    title: "سفريات — حجز طيران وفنادق أونلاين بأفضل الأسعار",
    description:
      "قارن أسعار رحلات الطيران واحجز تذاكرك وفنادقك أونلاين مع سفريات.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "travel",
};

// Organization + WebSite structured data: tells Google (and AI assistants)
// the canonical brand name in both scripts, so queries for "سفريات" or
// "Safariyat" resolve to this domain.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "@id": `${SITE_URL}/#organization`,
  name: "Safariyat",
  alternateName: ["سفريات", "Safriyat", "Safariyat Travel"],
  url: SITE_URL,
  description:
    "منصة عربية لحجز رحلات الطيران والفنادق أونلاين بأفضل الأسعار. Arabic online travel platform for booking flights and hotels.",
  availableLanguage: ["ar", "en"],
  makesOffer: [
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "حجز تذاكر طيران | Flight booking" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "حجز فنادق | Hotel booking" } },
  ],
};

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "سفريات",
  alternateName: "Safariyat",
  inLanguage: "ar",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${sansArabic.variable} ${materialSymbols.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
      </head>
      <body className="safariyat min-h-screen bg-background text-on-surface">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
