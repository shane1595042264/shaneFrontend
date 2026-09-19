import { VocabularyBrowser } from "@/components/vocabulary/vocabulary-browser";
import { API_URL } from "@/lib/api-url";
import type { VocabWord } from "@/lib/vocabulary-api";

// SHAN-507: this page used to be one big "use client" component, so the
// document it served contained 98 characters of navigation chrome and not a
// single word. The sitemap advertises /vocabulary at priority 0.7 and
// robots.txt allows it, and the data is public (GET /api/vocabulary/words
// needs no auth — only the add/delete controls do), so there was nothing to
// withhold: the content simply was not in the HTML. Anything that does not run
// JavaScript — crawlers, and the AI agents this site courts with /llms.txt —
// got a blank page. Rendering the first page of words here fixes that and
// removes the skeleton-then-content flash for real visitors too.
//
// 300s matches /blog and /courses. The window only affects a cold visitor's
// first paint: an author's own add or delete refreshes through the client's
// loadWords() call, so no server action is needed to bust this cache.
export const revalidate = 300;

// No query params, exactly like the client's own mount fetch — the backend's
// default limit of 100 applies to both, so the seeded list is what the browser
// would have fetched anyway and the first client render matches the server's.
//
// Fails soft to null rather than throwing: a backend blip mid-deploy then
// degrades to the original fetch-on-mount path (skeleton, then content, or the
// existing "Backend may be down" message) instead of taking the page down.
async function fetchInitialWords(): Promise<VocabWord[] | null> {
  try {
    const res = await fetch(`${API_URL}/api/vocabulary/words`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { words: VocabWord[] };
    return data.words ?? null;
  } catch {
    return null;
  }
}

export default async function VocabularyPage() {
  return <VocabularyBrowser initialWords={await fetchInitialWords()} />;
}
