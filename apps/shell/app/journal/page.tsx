import type { DiaryEntry } from "@shane/types";
import { JournalDocument } from "@/components/journal/journal-document";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

// ISR: cache the rendered index HTML at the edge for 5 min, matching the
// inner page fetch revalidate so outer-page and upstream-API caches stay
// aligned. Without SSR here, crawlers (and link-preview bots that don't run
// JS) saw only the loading skeleton — no entry dates, no article tags.
export const revalidate = 300;

const PAGE_SIZE = 100;

interface PaginatedEntries {
  entries: DiaryEntry[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchEntriesPage(offset: number): Promise<PaginatedEntries> {
  const res = await fetch(
    `${JOURNAL_API_URL}/api/journal/entries?limit=${PAGE_SIZE}&offset=${offset}`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) throw new Error(`Failed to fetch journal entries: ${res.status}`);
  return res.json();
}

async function fetchAllEntriesServer(): Promise<DiaryEntry[]> {
  const first = await fetchEntriesPage(0);
  const all = [...first.entries];
  let offset = first.entries.length;
  while (offset < first.total) {
    const page = await fetchEntriesPage(offset);
    if (page.entries.length === 0) break;
    all.push(...page.entries);
    offset += page.entries.length;
  }
  return all;
}

export default async function JournalPage() {
  const entries = await fetchAllEntriesServer();
  return <JournalDocument entries={entries} />;
}
