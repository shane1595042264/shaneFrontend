import type { MetadataRoute } from "next";
import { allElements } from "@/lib/element-registry";

const SITE_URL = "https://shanejli.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

type InternalElement = { route: string };

type JournalRow = { date: string; updatedAt: string | null };

type TripRow = { slug: string; updatedAt: string | null };

function liveInternalRoutes(): InternalElement[] {
  return allElements
    .filter((e) => e.type === "internal" && e.status === "live" && typeof e.route === "string" && e.route.startsWith("/"))
    .map((e) => ({ route: e.route as string }));
}

async function fetchAllJournalDates(): Promise<JournalRow[]> {
  const PAGE_SIZE = 100;
  const rows: JournalRow[] = [];
  let cursor: string | null | undefined;
  try {
    // Drain pages via the backend's cursor pagination (cursor -> nextCursor).
    // The endpoint has no offset/total contract; the safety cap mirrors
    // fetchAllEntries() in app/journal/page.tsx.
    while (rows.length < 5000) {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries?${qs}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return rows;
      const data = (await res.json()) as {
        entries: { date: string; updatedAt: string | null }[];
        nextCursor: string | null;
      };
      rows.push(...data.entries.map((e) => ({ date: e.date, updatedAt: e.updatedAt })));
      if (data.entries.length === 0 || !data.nextCursor) break;
      cursor = data.nextCursor;
    }
    return rows;
  } catch {
    return rows;
  }
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [journalDates, trips] = await Promise.all([fetchAllJournalDates(), fetchAllTrips()]);
  const elements = liveInternalRoutes();

  const now = new Date();

  const latestJournalUpdate = journalDates.reduce<Date | null>((max, row) => {
    const candidate = row.updatedAt ? new Date(row.updatedAt) : new Date(row.date + "T00:00:00Z");
    return !max || candidate > max ? candidate : max;
  }, null);

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
    let lastModified: Date = now;
    if (el.route === "/journal" && latestJournalUpdate) {
      lastModified = latestJournalUpdate;
    } else if (el.route === "/trips" && latestTripUpdate) {
      lastModified = latestTripUpdate;
    }
    entries.push({
      url: `${SITE_URL}${el.route}`,
      lastModified,
      changeFrequency: el.route === "/journal" ? "daily" : "weekly",
      priority: el.route === "/journal" ? 0.9 : 0.7,
    });
  }

  for (const row of journalDates) {
    entries.push({
      url: `${SITE_URL}/journal/${row.date}`,
      lastModified: row.updatedAt ? new Date(row.updatedAt) : new Date(row.date + "T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.6,
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

  return entries;
}
