// apps/shell/lib/docs/registry.ts
// Single source of truth for the Documentation element. Every surface
// (/docs, /docs/[slug], /llms.txt, /llms-full.txt, /docs/raw/[slug],
// sitemap) derives from DOC_PAGES. House rule (root CLAUDE.md): public
// API changes update the matching content module in the same commit.
import overview from "./content/overview";
import auth from "./content/auth";
import conventions from "./content/conventions";
import journalApi from "./content/journal-api";
import blogApi from "./content/blog-api";
import imagesApi from "./content/images-api";
import coursesApi from "./content/courses-api";
import scoreboardApi from "./content/scoreboard-api";
import tripsApi from "./content/trips-api";
import knowledgeApi from "./content/knowledge-api";
import aiApi from "./content/ai-api";
import vocabularyApi from "./content/vocabulary-api";
import trainingPlansApi from "./content/training-plans-api";
import elementsDirectory from "./content/elements-directory";

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  body: string;
  /**
   * When this page's content last changed, as an ISO-8601 date (SHAN-516).
   *
   * Doc bodies are static TS modules in this repo, so the commit that last
   * touched `content/<slug>.ts` is the content's real modification date —
   * there is no row to read it from. Seeded from `git log -1 --format=%cI`
   * per module. sitemap.ts is the only consumer: it used to stamp every doc
   * URL with sitemap-generation time, which is the kind of always-now lastmod
   * Google discards (and, worse, discards sitemap-wide, taking the accurate
   * trip and course dates down with it).
   *
   * Bumping it by hand was a comment-only rule until SHAN-689, and it was
   * missed on 10 of 14 pages (courses-api claimed 2026-09-26 while SHAN-681
   * had rewritten it on 2026-11-10). `bodyFingerprint` below now enforces it.
   */
  lastModified: string;
  /**
   * `fingerprint(body)` as of `lastModified` (SHAN-689). The check under
   * DOC_PAGES throws at import when they differ, which fails `npm run build`,
   * so a body cannot change without this page's date being looked at. When it
   * fires, set `lastModified` to now and paste the fingerprint from the error.
   * The hash is over the rendered body, so a change that reaches a page
   * indirectly (elements-directory is generated from lib/element-registry.ts)
   * trips it too.
   */
  bodyFingerprint: string;
}

/**
 * FNV-1a over the UTF-16 code units, as 8 hex digits. Not a security hash; it
 * only has to notice that a doc body changed. Pure JS rather than node:crypto
 * so the registry stays free of Node imports wherever a route bundles it.
 */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: "overview",
    title: "Overview",
    description:
      "What shanejli.com is, the architecture, base URLs, and how to discover the rest of these docs.",
    body: overview,
    lastModified: "2026-09-08T03:09:10-05:00",
    bodyFingerprint: "03077e68",
  },
  {
    slug: "auth",
    title: "Auth and Tokens",
    description:
      "JWTs vs personal access tokens, minting, scopes, rate limits, and identifying yourself.",
    body: auth,
    lastModified: "2026-11-13T09:10:00-06:00",
    bodyFingerprint: "f91c24a9",
  },
  {
    slug: "conventions",
    title: "API Conventions",
    description:
      "Error shape, validation, pagination cursors, ETag conditional GET, If-Match concurrency, and wire-format rules shared by every module.",
    body: conventions,
    lastModified: "2026-10-20T03:06:27-05:00",
    bodyFingerprint: "c3a2c4de",
  },
  {
    slug: "journal-api",
    title: "Journal API",
    description:
      "The full collaborative journal write surface: entries, appends, versions, suggestions, comments, reactions.",
    body: journalApi,
    lastModified: "2026-10-19T08:48:33-05:00",
    bodyFingerprint: "df958acb",
  },
  {
    slug: "blog-api",
    title: "Blog API",
    description:
      "The public blog: slug-keyed posts, versioned titles and bodies, drafts, tags, and revert.",
    body: blogApi,
    lastModified: "2026-09-27T21:19:24-05:00",
    bodyFingerprint: "685d7908",
  },
  {
    slug: "images-api",
    title: "Images API",
    description:
      "Uploading and serving journal images: caps, sniffing, quotas, and embedding rules.",
    body: imagesApi,
    lastModified: "2026-10-20T09:05:52-05:00",
    bodyFingerprint: "9474f814",
  },
  {
    slug: "courses-api",
    title: "Courses API",
    description:
      "The course catalog: AI classification on create, covers, star ratings, and comments.",
    body: coursesApi,
    lastModified: "2026-11-10T09:05:45-06:00",
    bodyFingerprint: "b3034b57",
  },
  {
    slug: "scoreboard-api",
    title: "Scoreboard API",
    description:
      "The IRL game scoreboard: games, players, live matches, scoring, and the game-icons search.",
    body: scoreboardApi,
    lastModified: "2026-10-14T21:05:29-05:00",
    bodyFingerprint: "64cfe14e",
  },
  {
    slug: "trips-api",
    title: "Trips API",
    description:
      "Public trip HTML upload, update, and delete, plus the trip-groups planning surface.",
    body: tripsApi,
    lastModified: "2026-10-17T03:04:48-05:00",
    bodyFingerprint: "e5a2a2fd",
  },
  {
    slug: "knowledge-api",
    title: "Knowledge API",
    description:
      "Free-text note ingest with AI classification, plus knowledge entries, vocabulary, and comments.",
    body: knowledgeApi,
    lastModified: "2026-11-13T03:07:44-06:00",
    bodyFingerprint: "307c0b70",
  },
  {
    slug: "ai-api",
    title: "AI and Reader Notes API",
    description:
      "Bring-your-own-key Explain: key detection and checks, the fixed explain prompt, usage, and private inline notes on blog posts and knowledge cards.",
    body: aiApi,
    lastModified: "2026-11-03T20:13:38-06:00",
    bodyFingerprint: "ec49c369",
  },
  {
    slug: "vocabulary-api",
    title: "Vocabulary API",
    description:
      "The word list and its typed connection graph: filters, enrichment, ownership rules, and how it differs from the Knowledge API.",
    body: vocabularyApi,
    lastModified: "2026-11-13T03:07:44-06:00",
    bodyFingerprint: "4fbe13ed",
  },
  {
    slug: "training-plans-api",
    title: "Training Plans API",
    description:
      "Goal-driven training plans for the Practice element: days, blocks, steps, the one-call nested create, and the completion tally.",
    body: trainingPlansApi,
    lastModified: "2026-09-10T03:15:16-05:00",
    bodyFingerprint: "e8910aa3",
  },
  {
    slug: "elements-directory",
    title: "Elements Directory",
    description:
      "Every element on the periodic table with its route, backend mount, and auth model.",
    body: elementsDirectory,
    lastModified: "2026-11-03T17:36:09-06:00",
    bodyFingerprint: "d9a8cef2",
  },
];

const staleDates = DOC_PAGES.filter((p) => fingerprint(p.body) !== p.bodyFingerprint);
if (staleDates.length > 0) {
  throw new Error(
    "Docs body changed without its lastModified moving: " +
      staleDates
        .map((p) => `${p.slug} (bodyFingerprint is now "${fingerprint(p.body)}")`)
        .join(", ") +
      ". In apps/shell/lib/docs/registry.ts set each page's lastModified to the time of this change " +
      "and bodyFingerprint to the value above; /sitemap.xml reports lastModified as the page's lastmod (SHAN-689).",
  );
}

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}
