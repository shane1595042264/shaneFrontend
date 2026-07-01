// app/journal/page.tsx
import { JournalIndexHeader } from "@/components/journal/journal-index-header";
import { JournalSearchList } from "@/components/journal/journal-search-list";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

// ISR: cache the rendered index HTML at the edge for 5 min, matching the
// per-entry revalidate. Crawlers see entry dates and snippets without JS.
export const revalidate = 300;

const PAGE_SIZE = 100;

interface JournalEntry {
  id: string;
  date: string;
  authorId: string;
  author: { id: string; name: string | null; avatarUrl: string | null } | null;
  status: "published" | "trashed";
  editCount: number;
  pendingSuggestionCount: number;
  commentCount: number;
  appendCount: number;
  currentVersionId: string | null;
  contentExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  entries: JournalEntry[];
  nextCursor: string | null;
}

async function fetchPage(cursor?: string | null): Promise<ListResponse> {
  const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries?${qs}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to fetch journal entries: ${res.status}`);
  return res.json();
}

// Never throw: a throw here fails the ISR render, which on a COLD cache (e.g. a
// fresh Vercel deploy racing a mid-redeploy Railway backend) surfaces as a raw
// 500 to the reader. Instead return whatever we drained plus a loadFailed flag,
// so the page always renders and the client can self-heal (see JournalSearchList).
async function fetchAllEntries(): Promise<{ entries: JournalEntry[]; loadFailed: boolean }> {
  const all: JournalEntry[] = [];
  let cursor: string | null | undefined;
  try {
    // Drain pages until nextCursor is null or we've already pulled too many (safety cap).
    while (all.length < 5000) {
      const page = await fetchPage(cursor ?? undefined);
      if (page.entries.length === 0) break;
      all.push(...page.entries);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return { entries: all, loadFailed: false };
  } catch (err) {
    console.warn("[journal] index seed fetch failed; rendering with client recovery", err);
    return { entries: all, loadFailed: true };
  }
}

// Server-rendered ISR seed for "today". The client component rehydrates
// with the viewer's actual timezone (see JournalSearchList) so authenticated
// users see today correctly. Chicago is the site's default TZ — it matches
// the most common visitor (the author) and is stable across UTC midnight.
function getTodayChicago(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function JournalPage() {
  const { entries, loadFailed } = await fetchAllEntries();
  const today = getTodayChicago();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Shane Journal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A wiki-style journal. Anyone signed in can write the first entry for a date; the author approves edits suggested by others.
        </p>
      </header>

      <JournalIndexHeader />

      <JournalSearchList entries={entries} today={today} initialLoadFailed={loadFailed} />
    </div>
  );
}
