import type { MetadataRoute } from "next";
import { allElements } from "@/lib/element-registry";
import { isDisallowedForCrawlers } from "@/lib/seo-routes";
import { DOC_PAGES } from "@/lib/docs/registry";
import { API_URL } from "@/lib/api-url";

const SITE_URL = "https://shanejli.com";

type InternalElement = { route: string };

type TripRow = { slug: string; updatedAt: string | null };

function liveInternalRoutes(): InternalElement[] {
  return allElements
    .filter((e) => e.type === "internal" && e.status === "live" && typeof e.route === "string" && e.route.startsWith("/"))
    // Never advertise a route that robots.txt blocks (auth-gated / thin pages
    // like /who-owes-me, /practice, /rng-capitalist). A sitemap listing a
    // disallowed URL is a Search Console warning and wasted crawl budget.
    .filter((e) => !isDisallowedForCrawlers(e.route as string))
    .map((e) => ({ route: e.route as string }));
}

/**
 * Newest parseable timestamp in `values`, or null when none of them parse.
 *
 * Null is a real answer here, not a failure to paper over: see the note on
 * `lastModifiedOf` for why an unknown date is omitted rather than guessed.
 */
function latest(values: (string | Date | null | undefined)[]): Date | null {
  return values.reduce<Date | null>((max, raw) => {
    if (!raw) return max;
    const candidate = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(candidate.getTime())) return max;
    return !max || candidate > max ? candidate : max;
  }, null);
}

async function fetchAllTrips(): Promise<TripRow[]> {
  try {
    const res = await fetch(`${API_URL}/api/trips`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { trips: { slug: string; updatedAt: string | null }[] };
    return data.trips.map((t) => ({ slug: t.slug, updatedAt: t.updatedAt }));
  } catch {
    return [];
  }
}

type CourseRowLite = { slug: string; updatedAt: string | null };

async function fetchAllCourses(): Promise<CourseRowLite[]> {
  const PAGE_SIZE = 100;
  const rows: CourseRowLite[] = [];
  let cursor: string | null | undefined;
  try {
    // Cursor drain: the endpoint pages at 100 and the sitemap needs every slug.
    while (rows.length < 5000) {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`${API_URL}/api/courses?${qs}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return rows;
      const data = (await res.json()) as {
        courses: { slug: string; updatedAt: string | null }[];
        nextCursor: string | null;
      };
      rows.push(...data.courses.map((c) => ({ slug: c.slug, updatedAt: c.updatedAt })));
      if (data.courses.length === 0 || !data.nextCursor) break;
      cursor = data.nextCursor;
    }
    return rows;
  } catch {
    return rows;
  }
}

type BlogRowLite = { slug: string; updatedAt: string | null };

// Same cursor drain as courses. The blog cursor is a publishedAt timestamp
// (not an isoDate like the journal's, SHAN-373), and the list endpoint is
// public, so no auth header is needed or possible here.
async function fetchAllBlogPosts(): Promise<BlogRowLite[]> {
  const PAGE_SIZE = 100;
  const rows: BlogRowLite[] = [];
  let cursor: string | null | undefined;
  try {
    while (rows.length < 5000) {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`${API_URL}/api/blog/posts?${qs}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return rows;
      const data = (await res.json()) as {
        posts: { slug: string; updatedAt: string | null }[];
        nextCursor: string | null;
      };
      rows.push(...data.posts.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })));
      if (data.posts.length === 0 || !data.nextCursor) break;
      cursor = data.nextCursor;
    }
    return rows;
  } catch {
    return rows;
  }
}

/**
 * Freshness signal for /knowledge and /vocabulary, which are two views of one
 * table: `GET /api/knowledge/entries` and `GET /api/vocabulary/words` both
 * select from `vocab_words` with the same `desc(createdAt), desc(id)` order
 * (SHAN-515), so one fetch dates both index pages.
 *
 * Deliberately a lower bound. The rows come back newest-created first, so an
 * edit to a word created long ago can sit past this page and not move the
 * date. Erring old is the safe direction: a lastmod that lags real content is
 * a missed recrawl, while one that runs ahead is the false claim this ticket
 * exists to remove.
 */
async function fetchLatestVocabUpdate(): Promise<Date | null> {
  try {
    const res = await fetch(`${API_URL}/api/vocabulary/words?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      words: { createdAt: string | null; updatedAt: string | null }[];
    };
    return latest(data.words.flatMap((w) => [w.createdAt, w.updatedAt]));
  } catch {
    return null;
  }
}

/** Freshness signal for /scoreboard. The games list is unpaginated, so unlike
 * the vocabulary one above this sees every row and is exact. */
async function fetchLatestScoreboardUpdate(): Promise<Date | null> {
  try {
    const res = await fetch(`${API_URL}/api/scoreboard/games`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      games: { createdAt: string | null; updatedAt: string | null }[];
    };
    return latest(data.games.flatMap((g) => [g.createdAt, g.updatedAt]));
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // No journal here on purpose: the journal went invite-only in SHAN-475, so
  // /journal and every /journal/<date> is crawler-disallowed (the prefix entry
  // in CRAWLER_DISALLOW filters the element route out of liveInternalRoutes)
  // and enumerating the dates would publish exactly the index the gate exists
  // to withhold.
  const [trips, courses, blogPosts, latestVocabUpdate, latestScoreboardUpdate] =
    await Promise.all([
      fetchAllTrips(),
      fetchAllCourses(),
      fetchAllBlogPosts(),
      fetchLatestVocabUpdate(),
      fetchLatestScoreboardUpdate(),
    ]);
  const elements = liveInternalRoutes();

  const latestTripUpdate = latest(trips.map((r) => r.updatedAt));
  const latestCourseUpdate = latest(courses.map((r) => r.updatedAt));
  const latestBlogUpdate = latest(blogPosts.map((r) => r.updatedAt));
  const latestDocUpdate = latest(DOC_PAGES.map((p) => p.lastModified));

  /**
   * SHAN-516: every lastmod traces to a row or a commit. This used to be one
   * shared `new Date()`, so 21 of the 24 URLs claimed to have changed at the
   * instant the sitemap was generated and the stamp advanced on each
   * revalidate. Google only honours lastmod that is consistently accurate and
   * drops it for the whole file when it is not, which meant the fabricated
   * dates were discrediting the genuinely correct trip and course ones
   * alongside them.
   *
   * An index page's date is the newest content it lists. A route with no
   * signal — a fetch that failed, an element added here without a case below —
   * returns null and its `lastmod` tag is omitted entirely. Omission is the
   * honest fallback: making no claim costs a recrawl hint, whereas falling
   * back to `now()` re-creates the bug on every backend outage.
   */
  function lastModifiedOf(route: string): Date | null {
    switch (route) {
      case "/trips":
        return latestTripUpdate;
      case "/courses":
        return latestCourseUpdate;
      case "/blog":
        return latestBlogUpdate;
      case "/docs":
        return latestDocUpdate;
      // Two routes over one table — see fetchLatestVocabUpdate.
      case "/knowledge":
      case "/vocabulary":
        return latestVocabUpdate;
      case "/scoreboard":
        return latestScoreboardUpdate;
      default:
        return null;
    }
  }

  /**
   * SHAN-524: /blog is a real route with a real empty state, but while the
   * post list is empty it is a thin page, and app/blog/page.tsx marks it
   * noindex on exactly this condition. One sitemap generation must not
   * advertise a URL that the same content state just told crawlers to skip —
   * a noindex URL in a sitemap is its own Search Console warning, and a
   * contentless one is the soft-404 finding the noindex is there to prevent.
   *
   * Content-driven, like the noindex: the first published post puts the entry
   * back with no one having to remember it. Only /blog is checked because only
   * /blog is empty — courses, trips, scoreboard, knowledge and vocabulary all
   * have rows, so a general empty-index rule would be written blind.
   *
   * A failed fetch also lands here and drops the entry for one revalidation
   * window. That is the same direction the page errs in, and for the same
   * reason: a crawler arriving during the outage gets the empty page.
   */
  const sitemapElements =
    blogPosts.length === 0
      ? elements.filter((el) => el.route !== "/blog")
      : elements;

  const entries: MetadataRoute.Sitemap = [];

  for (const el of sitemapElements) {
    entries.push({
      url: `${SITE_URL}${el.route}`,
      lastModified: lastModifiedOf(el.route) ?? undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const row of trips) {
    entries.push({
      url: `${SITE_URL}/trips/${row.slug}`,
      lastModified: latest([row.updatedAt]) ?? undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const row of courses) {
    entries.push({
      url: `${SITE_URL}/courses/${row.slug}`,
      lastModified: latest([row.updatedAt]) ?? undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const row of blogPosts) {
    entries.push({
      url: `${SITE_URL}/blog/${row.slug}`,
      lastModified: latest([row.updatedAt]) ?? undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const p of DOC_PAGES) {
    entries.push({
      url: `${SITE_URL}/docs/${p.slug}`,
      lastModified: latest([p.lastModified]) ?? undefined,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  // The homepage is the periodic table: its content is whatever the elements
  // currently hold, so it is exactly as fresh as the newest thing below it.
  // Computed last and unshifted so it sees every entry.
  const homeLastModified = latest(entries.map((e) => e.lastModified));

  entries.unshift({
    url: SITE_URL,
    lastModified: homeLastModified ?? undefined,
    changeFrequency: "daily",
    priority: 1.0,
  });

  return entries;
}
