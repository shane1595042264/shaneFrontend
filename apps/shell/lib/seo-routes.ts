/**
 * Single source of truth for crawler-blocked routes.
 *
 * robots.ts emits these as `Disallow` rules; sitemap.ts filters its internal
 * routes through `isDisallowedForCrawlers()` so the sitemap never advertises a
 * URL that robots.txt blocks (Google Search Console flags that mismatch as
 * "Sitemap contains URLs which are blocked by robots.txt").
 *
 * Keep crawlers off auth-gated / private / thin pages. Logged-out visitors to
 * these render only a sign-in gate (no public content), which Google treats as
 * soft-404s / low-quality and which waste crawl budget. Public content routes
 * (/journal, /journal/[date], the journal history subpage, /trips,
 * /knowledge, /vocabulary, /elements) stay crawlable.
 */
export const CRAWLER_DISALLOW: string[] = [
  "/settings",
  "/who-owes-me",
  "/practice",
  "/rng-capitalist",
  // Personal routine tracker — fully AuthGate-wrapped, so anonymous crawlers
  // see only the sign-in gate (thin/soft-404). Same category as the tools above.
  "/skincare",
  "/journal/tea",
  "/journal/inbox",
  // Mutation/form subpaths under a journal entry — auth-gated, thin, and
  // duplicative of the public entry page they act on.
  "/journal/*/edit",
  "/journal/*/append",
  "/journal/*/suggest",
];

/**
 * True when `path` is blocked for crawlers by one of the CRAWLER_DISALLOW
 * patterns. Supports the `*` wildcard used in robots patterns (matches any
 * sequence, mirroring robots.txt semantics). Non-wildcard patterns match the
 * path exactly or as a path-segment prefix (`/who-owes-me` blocks
 * `/who-owes-me` and `/who-owes-me/anything`).
 */
export function isDisallowedForCrawlers(path: string): boolean {
  return CRAWLER_DISALLOW.some((pattern) => {
    if (pattern.includes("*")) {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(`^${escaped}$`).test(path);
    }
    return path === pattern || path.startsWith(`${pattern}/`);
  });
}
