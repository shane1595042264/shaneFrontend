// apps/shell/lib/docs/registry.ts
// Single source of truth for the Documentation element. Every surface
// (/docs, /docs/[slug], /llms.txt, /llms-full.txt, /docs/raw/[slug],
// sitemap) derives from DOC_PAGES. House rule (root CLAUDE.md): public
// API changes update the matching content module in the same commit.
import overview from "./content/overview";
import auth from "./content/auth";
import conventions from "./content/conventions";
import journalApi from "./content/journal-api";
import imagesApi from "./content/images-api";
import coursesApi from "./content/courses-api";
import scoreboardApi from "./content/scoreboard-api";
import tripsApi from "./content/trips-api";
import knowledgeApi from "./content/knowledge-api";
import elementsDirectory from "./content/elements-directory";

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  body: string;
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: "overview",
    title: "Overview",
    description:
      "What shanejli.com is, the architecture, base URLs, and how to discover the rest of these docs.",
    body: overview,
  },
  {
    slug: "auth",
    title: "Auth and Tokens",
    description:
      "JWTs vs personal access tokens, minting, scopes, rate limits, and identifying yourself.",
    body: auth,
  },
  {
    slug: "conventions",
    title: "API Conventions",
    description:
      "Error shape, validation, pagination cursors, If-Match concurrency, and wire-format rules shared by every module.",
    body: conventions,
  },
  {
    slug: "journal-api",
    title: "Journal API",
    description:
      "The full collaborative journal write surface: entries, appends, versions, suggestions, comments, reactions.",
    body: journalApi,
  },
  {
    slug: "images-api",
    title: "Images API",
    description:
      "Uploading and serving journal images: caps, sniffing, quotas, and embedding rules.",
    body: imagesApi,
  },
  {
    slug: "courses-api",
    title: "Courses API",
    description:
      "The course catalog: AI classification on create, covers, star ratings, and comments.",
    body: coursesApi,
  },
  {
    slug: "scoreboard-api",
    title: "Scoreboard API",
    description:
      "The IRL game scoreboard: games, players, live matches, scoring, and the game-icons search.",
    body: scoreboardApi,
  },
  {
    slug: "trips-api",
    title: "Trips API",
    description:
      "Public trip HTML upload, update, and delete, plus the trip-groups planning surface.",
    body: tripsApi,
  },
  {
    slug: "knowledge-api",
    title: "Knowledge API",
    description:
      "Free-text note ingest with AI classification, plus knowledge entries, vocabulary, and comments.",
    body: knowledgeApi,
  },
  {
    slug: "elements-directory",
    title: "Elements Directory",
    description:
      "Every element on the periodic table with its route, backend mount, and auth model.",
    body: elementsDirectory,
  },
];

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}
