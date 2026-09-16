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
 * (/trips, /knowledge, /vocabulary, /elements) stay crawlable.
 */
export const CRAWLER_DISALLOW: string[] = [
  // SHAN-475: the whole journal is invite-only. A signed-out crawler sees only
  // the "You need access" card on every URL under here, so one prefix entry
  // covers the index, every date, the feeds, and every entry sub-page. This is
  // also what keeps /journal out of sitemap.xml — liveInternalRoutes() filters
  // the element route through isDisallowedForCrawlers().
  "/journal",
  "/settings",
  "/who-owes-me",
  "/practice",
  "/rng-capitalist",
  // Personal routine tracker — fully AuthGate-wrapped, so anonymous crawlers
  // see only the sign-in gate (thin/soft-404). Same category as the tools above.
  "/skincare",
  // Trip-planning groups (index, /new, /[slug], /[slug]/day/[day]) are all
  // AuthGate-wrapped — anonymous crawlers see only the sign-in gate. The public
  // /trips index and /trips/[slug] itineraries stay crawlable; only this
  // subtree is thin/soft-404. The prefix match covers every nested
  // /trips/groups/* route with one entry.
  "/trips/groups",
  // The HTML upload form. Signed-in-only (uploading needs a JWT), so anonymous
  // crawlers see just the sign-in gate. /trips/groups/new was already covered
  // by the prefix entry above, which is why this sibling slipped through.
  "/trips/new",
  // Blitz sync hand-off popup (SHAN-443): AuthGate-wrapped, single purpose.
  "/blitz/connect",
  // Kept explicitly even though "/journal" already covers it: tea entries are
  // a separate PIN-gated feature that merely lives under this path, so it must
  // stay disallowed if the journal tree ever moves.
  "/journal/tea",
  // SHAN-476: owner-only access management. Also already covered by the
  // "/journal" prefix; kept explicitly for the same reason as /journal/tea —
  // it must stay disallowed even if that prefix ever narrows.
  "/journal/access",
  // SHAN-484: members-only audit trail. Covered by the "/journal" prefix as
  // well; kept explicit for the same reason as the two entries above.
  "/journal/activity",
  // SHAN-487: the blog's authoring surface. /blog and /blog/<slug> stay
  // crawlable — this is only the author's tooling, which renders a sign-in
  // prompt for anyone else (thin/soft-404) and is worth no crawl budget.
  // /blog/preview covers the draft-reading tree, whose content is by definition
  // invisible to a crawler. The two wildcard entries are the only way to reach
  // a sub-path of a dynamic segment: a plain "/blog" prefix entry would
  // disallow the entire element, including the posts.
  "/blog/new",
  "/blog/preview",
  "/blog/*/edit",
  "/blog/*/history",
  // SHAN-477: transport alias, not a page. /learn/:slug proxies the course deck
  // hosted on the supermassive-courses origin so corporate DNS filters never
  // see that hostname. Letting crawlers in would index a second copy of HTML we
  // don't control the canonical tag on; /courses/:slug is the indexed surface
  // and already carries the Course JSON-LD pointing at itself.
  "/learn",
];

/**
 * Escape hatch for the build-time guard in lib/seo-routes-guard.ts, which fails
 * the build when a page that renders a sign-in gate is still crawlable.
 *
 * A page belongs here only when it is genuinely public content that happens to
 * show an inline sign-in prompt (a comment box on a public post, say) rather
 * than an auth wall. Nothing qualifies today: `components/blog/blog-comments`
 * is the one real instance of that pattern and it is a component, which the
 * guard already ignores. The list exists so that the next such page has an
 * honest way to declare itself instead of someone weakening the guard.
 *
 * Route paths are written the way the guard derives them: dynamic segments
 * collapse to `*`, so /blog/[slug] would be listed as "/blog/*".
 */
export const PUBLIC_WITH_SIGNIN_PROMPT: string[] = [];

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
