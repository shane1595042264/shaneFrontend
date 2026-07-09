import type { MetadataRoute } from "next";
import { CRAWLER_DISALLOW } from "@/lib/seo-routes";

const SITE_URL = "https://shanejli.com";

// Crawler-blocked routes live in one place (lib/seo-routes) so robots.txt and
// sitemap.xml can't drift apart — see the comment there for the rationale.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: CRAWLER_DISALLOW }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
