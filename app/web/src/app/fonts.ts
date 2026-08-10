import { IBM_Plex_Sans_Arabic } from "next/font/google";
import localFont from "next/font/local";

// Both faces are self-hosted by next/font so the browser never has to resolve
// fonts.googleapis.com and then fonts.gstatic.com before it can paint. The old
// <link rel="stylesheet"> pair cost two DNS+TLS handshakes on a render-blocking
// path, on top of the font downloads themselves.

// Body copy. `swap` is the right call here: a brief flash of the fallback face
// beats blank text, and the metric-adjusted fallback keeps the shift small.
// 300 is listed on the old stylesheet but never used anywhere in the app, and
// every weight here is preloaded — so carrying it just buys two dead requests.
export const sansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans-arabic",
});

// Icon font. `block` — deliberately not `swap` — is the fix for the stray words
// on first paint. Material Symbols draws its icons from ligatures, so the markup
// is literally <span class="material-symbols-outlined">flight_takeoff</span>.
// Under `swap` the browser paints that raw text in a fallback face until the
// icon font lands; `block` keeps the glyphs invisible for that window instead.
//
// Only the FILL axis is shipped. The variable `wght` axis the old stylesheet
// requested was never varied anywhere in the app — dropping it takes the file
// from 1100 KB to 447 KB with no visual change.
export const materialSymbols = localFont({
  src: "./fonts/material-symbols-outlined.woff2",
  weight: "400",
  display: "block",
  variable: "--font-material-symbols",
  // No system font carries these glyphs, so a metric-adjusted fallback would be
  // meaningless. The fixed 1em box in globals.css reserves the space instead.
  adjustFontFallback: false,
});
