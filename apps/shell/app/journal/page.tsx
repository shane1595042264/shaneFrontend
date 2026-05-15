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

async function fetchAllEntries(): Promise<JournalEntry[]> {
  const all: JournalEntry[] = [];
  let cursor: string | null | undefined;
  // Drain pages until nextCursor is null or we've already pulled too many (safety cap).
  while (all.length < 5000) {
    const page = await fetchPage(cursor ?? undefined);
    if (page.entries.length === 0) break;
    all.push(...page.entries);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return all;
}

// UTC day matches the backend and the [date] route's getTodayUtcStr,
// so "today" means the same thing on the index, the entry page, and the API.
function getTodayUtcStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function JournalPage() {
  const entries = await fetchAllEntries();
  const today = getTodayUtcStr();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Shane Journal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A wiki-style journal. Anyone signed in can write the first entry for a date; the author approves edits suggested by others.
        </p>
      </header>

      <JournalIndexHeader />

      <JournalSearchList entries={entries} today={today} />
    </div>
  );
}
