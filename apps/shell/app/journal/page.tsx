// app/journal/page.tsx
import { JournalIndexHeader } from "@/components/journal/journal-index-header";
import { JournalSearchList } from "@/components/journal/journal-search-list";
import { toPlainExcerpt } from "@/lib/journal-text";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;
const SITE_URL = "https://shanejli.com";

// ISR: cache the rendered index HTML at the edge for 5 min, matching the
// per-entry revalidate. Crawlers see entry dates and snippets without JS.
export const revalidate = 300;

const PAGE_SIZE = 100;

// Cap the number of posts emitted into the Blog JSON-LD. The index can hold
// thousands of entries; serializing all of them would bloat the SSR HTML for
// no SEO gain — search engines only need a representative recent sample.
const MAX_JSONLD_POSTS = 25;
const JSONLD_DESCRIPTION_LEN = 155;

// Escape `<` so an entry containing "</script>" cannot break out of the JSON-LD
// tag. Mirrors the helper in app/journal/[date]/page.tsx.
function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

  const journalUrl = `${SITE_URL}/journal`;
  const personEntity = {
    "@type": "Person" as const,
    name: "Shane Li",
    url: SITE_URL,
  };
  // Blog structured data: lets search engines recognize /journal as a blog with
  // a list of dated posts, mirroring the BlogPosting node on each detail page.
  // Entries arrive newest-first from the API, so slicing the head yields the
  // most recent posts.
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Shane's Journal",
    description:
      "Shane Li's daily journal — workouts, code, travel, and the texture of ordinary days.",
    url: journalUrl,
    inLanguage: "en-US",
    author: personEntity,
    publisher: personEntity,
    blogPost: entries.slice(0, MAX_JSONLD_POSTS).map((entry) => ({
      "@type": "BlogPosting" as const,
      headline: `${formatEntryDate(entry.date)} — Journal — Shane`,
      url: `${SITE_URL}/journal/${entry.date}`,
      datePublished: entry.createdAt,
      dateModified: entry.updatedAt,
      author: personEntity,
      ...(entry.contentExcerpt
        ? { description: toPlainExcerpt(entry.contentExcerpt, JSONLD_DESCRIPTION_LEN) }
        : {}),
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shane", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Journal", item: journalUrl },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(breadcrumbJsonLd) }}
      />
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
