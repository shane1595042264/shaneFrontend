import type { MetadataRoute } from "next";

const SITE_URL = "https://shanejli.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

type ElementRow = {
  symbol: string;
  route: string | null;
  type: "internal" | "external";
  status: string;
  updatedAt: string | null;
};

type JournalRow = { date: string; updatedAt: string | null };

async function fetchLiveInternalRoutes(): Promise<ElementRow[]> {
  try {
    const res = await fetch(`${API_URL}/api/elements`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { elements: ElementRow[] };
    return data.elements.filter(
      (e) => e.status === "live" && e.type === "internal" && typeof e.route === "string" && e.route.startsWith("/")
    );
  } catch {
    return [];
  }
}

async function fetchAllJournalDates(): Promise<JournalRow[]> {
  try {
    const PAGE_SIZE = 100;
    const rows: JournalRow[] = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const res = await fetch(
        `${JOURNAL_API_URL}/api/journal/entries?limit=${PAGE_SIZE}&offset=${offset}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) return rows;
      const data = (await res.json()) as {
        entries: { date: string; updatedAt: string | null }[];
        total: number;
      };
      total = data.total;
      rows.push(...data.entries.map((e) => ({ date: e.date, updatedAt: e.updatedAt })));
      if (data.entries.length === 0) break;
      offset += data.entries.length;
    }
    return rows;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [elements, journalDates] = await Promise.all([
    fetchLiveInternalRoutes(),
    fetchAllJournalDates(),
  ]);

  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  for (const el of elements) {
    entries.push({
      url: `${SITE_URL}${el.route}`,
      lastModified: el.updatedAt ? new Date(el.updatedAt) : now,
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

  return entries;
}
