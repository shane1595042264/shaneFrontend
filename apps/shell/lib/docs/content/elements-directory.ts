// apps/shell/lib/docs/content/elements-directory.ts
//
// GENERATED FROM THE ELEMENT REGISTRY. The rows below are built from
// allElements (lib/element-registry.ts) rather than hand-typed, so a new
// element cannot ship with a missing or stale row here.
//
// Root CLAUDE.md house rule: "Any change to a public API surface MUST update
// the matching content module in the same commit." That rule used to be
// aspirational - nothing checked it, and this table had silently fallen eight
// elements behind the registry. It is now mechanical: register an element
// without adding it to API_FACTS and this module throws at import, which fails
// the build, because /docs, /docs/[slug], /docs/raw/[slug], /llms.txt and
// /llms-full.txt are all statically generated from DOC_PAGES.
//
// To add an element: add its manifest to lib/element-registry.ts, then add one
// API_FACTS entry keyed by the same id. The build tells you if you forget.
import type { ElementConfig } from "@shane/types";
import { allElements } from "@/lib/element-registry";

interface ApiFacts {
  /** Backend mount, or plain language when the tile has no API of its own. */
  mount: string;
  /** Auth model, one phrase. */
  auth: string;
  /** "What it is" cell. Falls back to the element's registry description. */
  what?: string;
}

const NO_API = "(external link, no API)";
const NOT_BUILT = "(not built yet)";
const LEAVES_SITE = "n/a, leaves the site";
const PLACEHOLDER = "n/a, placeholder tile";

const API_FACTS: Record<string, ApiFacts> = {
  journal: {
    mount: "/api/journal",
    auth: "invite-only: membership on every route, scoped writes",
    what: "collaborative wiki-journal, see [Journal API](/docs/journal-api)",
  },
  blog: {
    mount: "/api/blog",
    auth: "public reads; author-only scoped writes",
    what: "public long-form posts, slug-keyed with versioned history, see [Blog API](/docs/blog-api)",
  },
  documentation: {
    mount: "(frontend only)",
    auth: "fully public",
    what: "these docs; /llms.txt, /llms-full.txt",
  },
  blitz: {
    mount: "/api/blitz (sync session) + sync.shanejli.com (SuperSync, its own service)",
    auth: "Sign in with Google inside Blitz; browser JWT only, no PAT access",
    what: "self-hosted Super Productivity fork: tasks, Pomodoro, planner, cross-device sync; see [Auth and Tokens](/docs/auth)",
  },
  courses: {
    mount: "/api/courses",
    auth: "public reads; scoped writes",
    what: "AI-classified course catalog, see [Courses API](/docs/courses-api)",
  },
  trips: {
    mount: "/api/trips",
    auth: "public reads AND anonymous create",
    what: "trip itinerary pastebin, see [Trips API](/docs/trips-api)",
  },
  knowledge: {
    mount: "/api/knowledge",
    auth: "public reads; scoped writes",
    what: "AI-classified knowledge base, see [Knowledge API](/docs/knowledge-api)",
  },
  vocabulary: {
    mount: "/api/vocabulary",
    auth: "public reads; knowledge:write writes",
    what: "narrower view of the same data, see [Vocabulary API](/docs/vocabulary-api)",
  },
  scoreboard: {
    mount: "/api/scoreboard",
    auth: "public reads; entries:write writes",
    what: "IRL game scoreboard, see [Scoreboard API](/docs/scoreboard-api)",
  },
  skincare: {
    mount: "/api/skincare",
    auth: "authed only, owner-scoped",
    what: "AM/PM routine tracker",
  },
  practice: {
    mount: "/api/practice",
    auth: "authed, practice:write writes",
    what: "training sessions, vocab SRS, and [training plans](/docs/training-plans-api)",
  },
  "rng-capitalist": {
    mount: "/api/rng",
    auth: "authed (any PAT), no scope",
    what: "AI purchase-decision roulette; evaluate costs an LLM call, 10/min",
  },
  "who-owes-me": {
    mount: "/api/loans",
    auth: "authed, no scope",
    what: "personal loan ledger; non-owner mutations 403",
  },

  // Tiles that leave the site. Listed so an agent reading this directory stops
  // looking for a backend mount behind them.
  github: { mount: NO_API, auth: LEAVES_SITE },
  youtube: { mount: NO_API, auth: LEAVES_SITE },
  bilibili: { mount: NO_API, auth: LEAVES_SITE },
  linkedin: { mount: NO_API, auth: LEAVES_SITE },
  nibbler: { mount: NO_API, auth: LEAVES_SITE },
  wattpad: { mount: NO_API, auth: LEAVES_SITE },

  // Placeholder tiles with no route and no API yet.
  hardcore: { mount: NOT_BUILT, auth: PLACEHOLDER },
  inventory: { mount: NOT_BUILT, auth: PLACEHOLDER },
};

// Both directions, so the table can drift neither behind nor ahead of the
// registry: a new element with no row fails the build, and so does a row left
// behind after its element was deleted.
const registeredIds = new Set(allElements.map((e) => e.id));
const missingFacts = allElements.map((e) => e.id).filter((id) => !API_FACTS[id]);
const staleFacts = Object.keys(API_FACTS).filter((id) => !registeredIds.has(id));
if (missingFacts.length > 0 || staleFacts.length > 0) {
  const problems = [
    missingFacts.length > 0 ? "no API_FACTS entry for " + missingFacts.join(", ") : "",
    staleFacts.length > 0
      ? "API_FACTS entry for unregistered element " + staleFacts.join(", ")
      : "",
  ].filter(Boolean);
  throw new Error(
    "Elements Directory docs are out of sync with lib/element-registry.ts: " +
      problems.join("; ") +
      ". Fix apps/shell/lib/docs/content/elements-directory.ts " +
      "(root CLAUDE.md: public API changes update the matching docs module in the same commit).",
  );
}

/** Real API mounts that have no periodic-table tile of their own. */
const UNTILED: Array<{ name: string; where: string } & ApiFacts> = [
  {
    name: "Tea",
    where: "/journal/tea",
    mount: "/api/tea-entries",
    auth: "authed author; PIN-gated shares",
    what: "private entries unlocked per-entry via the X-Tea-Pin header",
  },
  {
    name: "Slot assignments",
    where: "(homepage)",
    mount: "/api/slot-assignments",
    auth: "authed",
    what: "periodic-table layout persistence; PUT replaces the whole map",
  },
  {
    name: "Activities",
    where: "(journal sidebar)",
    mount: "/api/activities/:date",
    auth: "public read only",
    what: "daily activity feed; ingest is cron/admin only",
  },
];

function whereFor(e: ElementConfig): string {
  if (e.route) return e.route;
  if (e.url) return e.url.replace(/^https?:\/\//, "") + " (external, new tab)";
  return "(no route yet)";
}

function row(cells: string[]): string {
  return "| " + cells.join(" | ") + " |";
}

const elementRows = allElements.map((e) => {
  const facts = API_FACTS[e.id];
  return row([e.name, whereFor(e), facts.mount, facts.auth, facts.what ?? e.description]);
});

const untiledRows = UNTILED.map((u) =>
  row([u.name, u.where, u.mount, u.auth, u.what ?? ""]),
);

const TEA_PIN_GOTCHA =
  "- Tea PIN flow: GET /api/tea-entries/:id returns 401 `PIN required` without a valid 4-digit `X-Tea-Pin` header, 403 on a wrong PIN, 429 after 10 failures per entry per minute. Distinguish the three.";
const SKINCARE_GOTCHA =
  "- Skincare reorder is `POST /api/skincare/reorder` (declared before /:id) and requires the COMPLETE ordered id list for that routine.";
const SCOREBOARD_GOTCHA =
  "- Scoreboard `GET /icons/search` requires auth because it spends GitHub API quota; deleting a player with match history is a 409.";

const body = [
  "# Elements Directory",
  "",
  'Every element on the periodic table, its route, backend mount, and auth model, in one table. "Public reads" means unauthenticated GETs; writes always need a token unless noted.',
  "",
  "This table is generated from the site's element registry, so it lists every tile that actually renders on the homepage, including the ones that are external links or not built yet.",
  "",
  row(["Element", "Route", "Backend mount", "Auth model", "What it is"]),
  row(["---", "---", "---", "---", "---"]),
  ...elementRows,
  ...untiledRows,
  "",
  "## Cross-element gotchas",
  "",
  TEA_PIN_GOTCHA,
  SKINCARE_GOTCHA,
  SCOREBOARD_GOTCHA,
  "- RNG evaluate auto-bans a denied category for 30 days; there is no unban endpoint.",
  "- Admin-gated or machine-only surfaces (practice settings PATCH, activity ingest, wechat ingest, calendar connect) are not usable with PATs; skip them.",
  "",
].join("\n");

export default body;
