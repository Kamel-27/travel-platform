import type { MetadataRoute } from "next";

const SITE_URL = "https://www.safariyat.live";

// Private/transactional routes have no search value and would only dilute
// crawl budget; everything public stays crawlable — including AI crawlers
// (GPTBot, ClaudeBot, PerplexityBot) which fall under `*` for GEO visibility.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/checkout",
          "/auth",
          "/signin",
          "/user-dashboard",
          "/dashboard-overview",
          "/manage-bookings",
          "/admin",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
