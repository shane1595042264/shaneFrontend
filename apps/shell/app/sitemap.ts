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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // No journal here on purpose: the journal went invite-only in SHAN-475, so
  // /journal and every /journal/<date> is crawler-disallowed (the prefix entry
  // in CRAWLER_DISALLOW filters the element route out of liveInternalRoutes)
  // and enumerating the dates would publish exactly the index the gate exists
  // to withhold.
  const [trips, courses, blogPosts] = await Promise.all([
    fetchAllTrips(),
    fetchAllCourses(),
    fetchAllBlogPosts(),
  ]);
  const elements = liveInternalRoutes();

  const now = new Date();

  const latestTripUpdate = trips.reduce<Date | null>((max, row) => {
    if (!row.updatedAt) return max;
    const candidate = new Date(row.updatedAt);
    return !max || candidate > max ? candidate : max;
  }, null);

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  for (const el of elements) {
    const lastModified: Date =
      el.route === "/trips" && latestTripUpdate ? latestTripUpdate : now;
    entries.push({
      url: `${SITE_URL}${el.route}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const row of trips) {
    entries.push({
      url: `${SITE_URL}/trips/${row.slug}`,
      lastModified: row.updatedAt ? new Date(row.updatedAt) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const row of courses) {
    entries.push({
      url: `${SITE_URL}/courses/${row.slug}`,
      lastModified: row.updatedAt ? new Date(row.updatedAt) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const row of blogPosts) {
    entries.push({
      url: `${SITE_URL}/blog/${row.slug}`,
      lastModified: row.updatedAt ? new Date(row.updatedAt) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const p of DOC_PAGES) {
    entries.push({
      url: `${SITE_URL}/docs/${p.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}
