// app/journal/page.tsx
import Link from "next/link";
import { toPlainExcerpt } from "@/lib/journal-text";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

// ISR: cache the rendered index HTML at the edge for 5 min, matching the
// per-entry revalidate. Crawlers see entry dates and snippets without JS.
export const revalidate = 300;

const PAGE_SIZE = 100;
const EXCERPT_LEN = 200;

interface JournalEntry {
  id: string;
  date: string;
  authorId: string;
  status: "published" | "trashed";
  editCount: number;
  pendingSuggestionCount: number;
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

function formatDateLong(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function groupByYear(entries: JournalEntry[]): Array<{ year: string; entries: JournalEntry[] }> {
  const map = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const year = e.date.slice(0, 4);
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(e);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, list]) => ({ year, entries: list }));
}

export default async function JournalPage() {
  const entries = await fetchAllEntries();
  const grouped = groupByYear(entries);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Shane Journal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A wiki-style journal. Anyone signed in can write the first entry for a date; the author approves edits suggested by others.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ year, entries: yearEntries }) => (
            <section key={year}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {year}
              </h2>
              <ul className="divide-y rounded-md border">
                {yearEntries.map((e) => {
                  const excerpt = e.contentExcerpt ? toPlainExcerpt(e.contentExcerpt, EXCERPT_LEN) : "";
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/journal/${e.date}`}
                        className="block px-4 py-3 hover:bg-muted/50"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono text-sm tabular-nums">{e.date}</span>
                          <span className="ml-4 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {e.editCount} edit{e.editCount === 1 ? "" : "s"}
                            </span>
                            {e.pendingSuggestionCount > 0 && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                                {e.pendingSuggestionCount} pending
                              </span>
                            )}
                          </span>
                        </div>
                        {excerpt && (
                          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                            {excerpt}
                          </p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
