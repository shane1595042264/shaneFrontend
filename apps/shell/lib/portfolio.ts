/**
 * Curated featured work for the homepage Portfolio view (SHAN-517).
 *
 * Deliberately NOT derived from lib/element-registry.ts. That registry is the
 * periodic table's inventory: every tile, including coming-soon stubs, private
 * tools and social links, and it is also the generator input for the docs
 * Elements Directory table, which throws at import if a tile has no API_FACTS
 * row (SHAN-494). Portfolio answers a different question — "what should a
 * stranger see first" — so it is a hand-picked list with its own longer copy,
 * and adding an entry here can never break the docs build.
 *
 * `id` matches the element-registry id where one exists, so the two lists can
 * be cross-referenced later without either one owning the other.
 */
export interface PortfolioProject {
  id: string;
  /** Display name. */
  name: string;
  /** Bare hostname shown under the name — no scheme, no trailing slash. */
  host: string;
  url: string;
  /** One short line. Shown large. */
  tagline: string;
  /** Two or three sentences. Shown small, under the tagline. */
  blurb: string;
  /** Short lowercase facets rendered as chips. */
  tags: string[];
  /** Ships as the "01", "02" ... index on the card. */
  year: string;
}

export const FEATURED_PROJECTS: PortfolioProject[] = [
  {
    id: "nibbler",
    name: "Nibbler",
    host: "nibbook.com",
    url: "https://nibbook.com",
    tagline: "An AI book reader that remembers the words you didn't know.",
    blurb:
      "Read anything in the browser. Every word you stop on gets defined in place, kept, and folded into a vocabulary you actually come back to. The reading is the input; the studying happens on its own.",
    tags: ["ai", "reading", "vocabulary"],
    year: "01",
  },
];

/**
 * Empty slots rendered after the real entries. They are decoration with a job:
 * one featured project on its own reads like the whole portfolio, and these
 * say the list is a selection rather than the total. Purely presentational —
 * aria-hidden at the call site, never focusable, no link.
 */
export const RESERVED_SLOTS = ["02", "03"] as const;
