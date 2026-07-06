import type { MetadataRoute } from "next";

const SITE_URL = "https://shanejli.com";

// Keep crawlers off auth-gated / private / thin pages. Logged-out visitors to
// these render only a sign-in gate (no public content), which Google treats as
// soft-404s / low-quality and which waste crawl budget. Public content routes
// (/journal, /journal/[date], /journal/*/history, /trips, /knowledge,
// /vocabulary, /elements) stay crawlable.
const DISALLOW = [
  "/settings",
  "/who-owes-me",
  "/practice",
  "/rng-capitalist",
  "/journal/tea",
  "/journal/inbox",
  // Mutation/form subpaths under a journal entry — auth-gated, thin, and
  // duplicative of the public entry page they act on.
  "/journal/*/edit",
  "/journal/*/append",
  "/journal/*/suggest",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: DISALLOW }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
