import { allElements } from "@/lib/element-registry";
import { isDisallowedForCrawlers } from "@/lib/seo-routes";

/**
 * The site-wide navigation's link set (SHAN-526).
 *
 * This exists because the NavBar's links were hand-written and had drifted
 * badly from what the site actually publishes. It carried four entries — `/`
 * labelled "Table", `/journal`, `/rng-capitalist`, `/knowledge` — of which two
 * were sign-in gates for everyone but Shane, while `/courses`, `/docs`,
 * `/scoreboard`, `/trips` and `/vocabulary` appeared in no navigation on any
 * page. A visitor arriving on `/courses/pi2-heist` from search had no path to
 * any other public route; the homepage was the only exception, and only because
 * the hidden periodic table carries those links in its markup.
 *
 * So the public half is derived rather than listed. `publicNavLinks()` uses the
 * same predicate `app/sitemap.ts` applies in `liveInternalRoutes()`, against
 * the same registry, which means the nav and the sitemap cannot come to
 * disagree about which routes are public — a second hand-written list is the
 * exact failure this replaces. Ship a new public element and it appears here.
 */
export interface NavLink {
  href: string;
  label: string;
  /**
   * Match the pathname exactly rather than by prefix. Only `/` needs it: every
   * other route would mark itself active on every page of the site.
   */
  exact?: boolean;
}

/**
 * Labelled "Home", not "Table".
 *
 * "Table" was accurate while the homepage was only the periodic table. Since
 * SHAN-517 a signed-out visitor opens on the Portfolio view instead, so the
 * label named the half of the page they do not land on. "Home" is true of both
 * views and stays true if the default ever flips again.
 */
export const HOME_LINK: NavLink = { href: "/", label: "Home", exact: true };

/**
 * Shorter labels for the nav row only. The registry names are written for the
 * periodic table's tiles and its docs table, where there is room for
 * "Documentation"; seven of them in one horizontal row is a different
 * constraint. Anything with no entry here falls back to the registry name, so
 * a new element gets a real label rather than being silently dropped.
 */
const NAV_LABEL_OVERRIDES: Record<string, string> = {
  "/docs": "Docs",
  "/vocabulary": "Vocab",
  "/scoreboard": "Scores",
};

/**
 * Public, crawlable, and still kept out of the nav. Empty, and worth keeping
 * empty.
 *
 * It held `/blog` from SHAN-526 until SHAN-538. SHAN-524 had marked the blog
 * noindex and pulled it from the sitemap while it held zero posts, so pointing
 * every page on the site at an empty index would have undone that. The entry
 * carried the instruction "delete this when the blog has content" — and the
 * blog got content on 2026-09-25 without anyone deleting it.
 *
 * The lesson, since this is the second list in this file to go stale the same
 * way: a static mirror of a data-driven decision drifts silently and in only
 * one direction. `app/blog/page.tsx` and `app/sitemap.ts` made the same call
 * from a fetched post count, so both reversed themselves the moment the post
 * published; this constant could not, because the NavBar is a client component
 * that renders on every page and must not fetch. That asymmetry is real and
 * has no clean fix here — a build-time guard would have to reach the API and
 * would turn a backend blip into a failed build — so the mitigation is to keep
 * this list empty. An entry here is a promise someone has to remember to
 * break, and the blog spent two days indexed, sitemapped, and linked from
 * nowhere because that promise was forgotten.
 *
 * Prefer expressing "not in the nav" through CRAWLER_DISALLOW instead, which
 * `publicNavLinks()` already honours and which is the same predicate the
 * sitemap uses, so the two cannot disagree.
 */
const NAV_EXCLUDE = new Set<string>();

/**
 * Reading order for the routes that have an opinion about it. Anything not
 * listed sorts after these, alphabetically by label, so auto-inclusion and a
 * curated sequence coexist: a new element lands at the end of the row instead
 * of in an arbitrary slot, and nothing has to be added here for it to appear.
 */
const NAV_ORDER = [
  // First since SHAN-538. Leaving `/blog` unlisted would have put it last:
  // unlisted routes sort after every listed one, which is the right default for
  // a new element nobody has an opinion about and the wrong slot for the site's
  // only public long-form writing. It leads because it is the surface a
  // stranger who liked the homepage is most likely to want next, and because
  // the ordering below already runs roughly newest-interest to most-niche.
  "/blog",
  "/courses",
  "/docs",
  "/knowledge",
  "/vocabulary",
  "/trips",
  "/scoreboard",
];

/**
 * Every public content route, in nav order. Excludes `/` — that is `HOME_LINK`,
 * which is not an element and needs the exact-match behaviour.
 *
 * The filter is deliberately identical to `liveInternalRoutes()` in
 * app/sitemap.ts. `isDisallowedForCrawlers` is what keeps the auth-gated
 * elements out: `/journal`, `/rng-capitalist`, `/practice`, `/skincare`,
 * `/who-owes-me` are all in CRAWLER_DISALLOW precisely because a signed-out
 * visitor sees nothing but a sign-in gate on them, which is the same reason
 * they do not belong in a nav rendered for signed-out visitors.
 */
export function publicNavLinks(): NavLink[] {
  return allElements
    .filter(
      (element) =>
        element.type === "internal" &&
        element.status === "live" &&
        typeof element.route === "string" &&
        element.route.startsWith("/") &&
        !isDisallowedForCrawlers(element.route) &&
        !NAV_EXCLUDE.has(element.route),
    )
    .map((element) => {
      const href = element.route as string;
      return { href, label: NAV_LABEL_OVERRIDES[href] ?? element.name };
    })
    .sort((a, b) => {
      const ai = NAV_ORDER.indexOf(a.href);
      const bi = NAV_ORDER.indexOf(b.href);
      if (ai !== -1 && bi !== -1) return ai - bi;
      // Unlisted routes go last; among themselves, alphabetically, so the
      // order is stable rather than dependent on registry import order.
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.label.localeCompare(b.label);
    });
}

/**
 * Shane's shortcuts. Rendered only once a session has resolved and found a
 * user — see the gate in components/nav-bar.tsx for why that has to happen
 * after hydration rather than during it.
 *
 * Both are crawler-disallowed sign-in gates, so for every visitor who is not
 * the owner these were four-link-nav slots that could only disappoint, and
 * every page was handing internal-link equity to URLs robots.txt blocks.
 *
 * This is the pair the nav already had, kept as-is. Shane's other gated tools
 * (`/practice`, `/who-owes-me`, `/skincare`) were not in the nav before and are
 * not being added here — reachable from the periodic table, same as always.
 */
export const PRIVATE_NAV_LINKS: NavLink[] = [
  { href: "/journal", label: "Journal" },
  { href: "/rng-capitalist", label: "RNG" },
];
