import type { MarkdownHeading } from "@/lib/markdown-headings";

/**
 * A prose post needs more sections than a reference page before a nav earns its
 * space. /docs shows one from 3 headings because a doc IS a lookup table and a
 * reader arrives knowing which part they want; a three-section essay is just an
 * essay, and a list of its three headings above it is the page twice. The first
 * real post has 25.
 */
const MIN_TOC_HEADINGS = 5;

export function shouldShowToc(headings: MarkdownHeading[]): boolean {
  return headings.length >= MIN_TOC_HEADINGS;
}

/**
 * SHAN-542: "On this page" for a long post.
 *
 * A Server Component on the published page, so every row is an internal link in
 * the cached HTML rather than something a crawler has to run JS to find. Rows
 * come from the same extractBodyHeadings() output the rendered headings take
 * their ids from, so a link here resolves by construction instead of by two
 * implementations agreeing.
 */
export function PostToc({ headings }: { headings: MarkdownHeading[] }) {
  return (
    <nav
      aria-label="On this page"
      className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-4"
    >
      {/* A <p>, not a heading. The post's own sections are the h2s below, and a
          heading here would insert a section into the outline that isn't one. The
          nav's aria-label carries the name for assistive tech. */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">On this page</p>
      <ul className="mt-2 space-y-1 text-sm">
        {headings.map((h) => (
          <li key={h.id} className={h.depth === 3 ? "pl-4" : undefined}>
            <a href={`#${h.id}`} className="text-gray-400 hover:text-white">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
