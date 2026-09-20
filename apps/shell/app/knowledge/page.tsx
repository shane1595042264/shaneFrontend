import { KnowledgeBrowser } from "@/components/knowledge/knowledge-browser";
import { API_URL } from "@/lib/api-url";
import type {
  KnowledgeEntry,
  PaginatedKnowledgeEntries,
} from "@/lib/knowledge-api";

// SHAN-509: this page used to be one big "use client" component. Next emits a
// client-component page as a `ClientPageRoot` client reference and never runs
// it during the prerender, so the only thing that reached the static document
// was app/knowledge/loading.tsx: 30 kB of HTML carrying 94 characters of
// visible text, all of it navigation chrome. The sitemap advertises
// /knowledge, robots.txt allows it, and the data is public — GET
// /api/knowledge/entries needs no auth, only the add/delete controls do — so
// there was nothing to withhold. Anything that does not run JavaScript,
// crawlers and the AI agents this site courts with /llms.txt, got a skeleton.
//
// 300s matches /blog, /courses, /vocabulary and /scoreboard. The window only
// affects a cold visitor's first paint: an author's own note, edit or delete
// refreshes through the client's own loadEntries() call, so no server action is
// needed to bust this cache.
export const revalidate = 300;

// What fetchAllEntries() asks for, page by page, so the seed is the list the
// browser would have fetched on mount and the first client render matches the
// server's. Prod holds 45 entries today, so this is one request; the loop is
// here so that stays true past 100. Capped so a runaway total cannot turn one
// revalidation into an unbounded fan-out.
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

// Fails soft to null rather than throwing: a backend blip mid-deploy then
// degrades to the original fetch-on-mount path (skeleton, then content, or the
// existing "Backend may be down" message) instead of taking the page down.
async function fetchInitialEntries(): Promise<KnowledgeEntry[] | null> {
  try {
    const all: KnowledgeEntry[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(
        `${API_URL}/api/knowledge/entries?limit=${PAGE_SIZE}&offset=${all.length}`,
        { next: { revalidate } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as PaginatedKnowledgeEntries;
      if (!Array.isArray(data.entries)) return null;
      all.push(...data.entries);
      if (data.entries.length === 0 || all.length >= data.total) return all;
    }
    // More entries than the cap allows. Seeding a truncated list would be worse
    // than seeding nothing: a seeded browser skips its own mount fetch, so the
    // missing entries would never arrive and the count line would lie. Hand the
    // whole job back to the client's paginating fetch instead.
    return null;
  } catch {
    return null;
  }
}

export default async function KnowledgePage() {
  return <KnowledgeBrowser initialEntries={await fetchInitialEntries()} />;
}
