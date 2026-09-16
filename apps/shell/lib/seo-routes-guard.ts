// apps/shell/lib/seo-routes-guard.ts
//
// BUILD-TIME GUARD for lib/seo-routes.ts. Walks app/ and fails the build if a
// page that renders a sign-in gate instead of public content is not matched by
// CRAWLER_DISALLOW.
//
// Why this exists: CRAWLER_DISALLOW is the single source of truth for both
// robots.txt and sitemap.xml, but staying complete used to be a thing you had
// to remember. It repeatedly was not remembered - SHAN-371 (/skincare),
// SHAN-459 (/trips/new), SHAN-475, SHAN-476, SHAN-484 and SHAN-487 were all
// reactive patches filed after an auth-gated page had already shipped into
// robots.txt and sitemap.xml as a soft-404. The blind spot was always the same
// shape: a sibling route that looked covered by a neighbouring prefix entry but
// was not. This turns that recurring manual review into an error message that
// names the exact route to add, the same way SHAN-494 made the Elements
// Directory docs rule mechanical rather than aspirational.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation therefore fails `npm run build` loudly and can never 500 robots.txt
// or sitemap.xml in production.
import fs from "node:fs";
import path from "node:path";
import { isDisallowedForCrawlers, PUBLIC_WITH_SIGNIN_PROMPT } from "./seo-routes";

/**
 * Strips comments so that merely *mentioning* a gate component does not read as
 * rendering one. app/courses/page.tsx carries the line "// Public catalog: no
 * AuthGate." and is a genuinely public catalog, so this distinction is the
 * difference between a useful guard and a false positive on day one.
 *
 * Block comments go first, which also covers the JSX braces-slash-star form.
 * Line comments are then stripped only when the `//` is not preceded by a
 * colon, so an `https://` inside a string literal does not truncate its line.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

/**
 * Converts an app-router file path to the route it serves, in the shape
 * `isDisallowedForCrawlers` expects. Route groups `(marketing)` contribute no
 * segment; dynamic segments `[id]` / `[...rest]` become `*`, which the
 * wildcard-aware matcher handles and which non-wildcard prefix entries still
 * match through their `startsWith` branch.
 */
function routeFromFile(appDir: string, filePath: string): string {
  const segments = path
    .relative(appDir, path.dirname(filePath))
    .split(path.sep)
    .filter((segment) => segment.length > 0 && !segment.startsWith("("))
    .map((segment) => (segment.startsWith("[") ? "*" : segment));
  return segments.length > 0 ? `/${segments.join("/")}` : "/";
}

function collectPageFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPageFiles(full, found);
    } else if (entry.name === "page.tsx") {
      found.push(full);
    }
  }
  return found;
}

/**
 * True when this page renders a sign-in gate rather than public content.
 *
 * Two structural signals, both read only from page/layout modules so that a
 * shared component is never mistaken for a gate - components/blog/blog-comments
 * renders <LoginButton> as a comment-box prompt inside the fully public
 * /blog/[slug], and counting it would be wrong:
 *
 *  1. `<AuthGate>` on the page itself or on any ancestor layout. The ancestor
 *     walk is what catches app/journal/tea/[id]/edit, which is gated by
 *     app/journal/tea/[id]/layout.tsx rather than by its own module.
 *  2. `<LoginButton>` rendered directly by the page module. This is the manual
 *     gate pattern - /trips/new and the journal writer pages hand-roll the
 *     useAuth check instead of wrapping in AuthGate, and /trips/new is exactly
 *     the page that leaked in SHAN-459.
 *
 * Known limit, stated so nobody over-trusts a green build: a page that delegates
 * its gate to some third component renders neither marker and is invisible here.
 * The journal pages are the live example - they gate through
 * components/journal/journal-access-gate, and it is the "/journal" prefix entry
 * rather than this guard that keeps them out of robots.txt. Adding a new gate
 * component therefore means teaching it to this file.
 */
function rendersSignInGate(appDir: string, pageFile: string): boolean {
  const page = stripComments(fs.readFileSync(pageFile, "utf8"));
  if (page.includes("<AuthGate") || page.includes("<LoginButton")) return true;

  let dir = path.dirname(pageFile);
  while (dir.startsWith(appDir)) {
    const layout = path.join(dir, "layout.tsx");
    if (fs.existsSync(layout) && stripComments(fs.readFileSync(layout, "utf8")).includes("<AuthGate")) {
      return true;
    }
    if (dir === appDir) break;
    dir = path.dirname(dir);
  }
  return false;
}

/**
 * Throws if any sign-in-gated route is still crawlable. Called from
 * next.config.ts; `appDir` is resolved there from the build's cwd.
 */
export function assertCrawlerDisallowCoverage(appDir: string): void {
  if (!fs.existsSync(appDir)) {
    throw new Error(
      `seo-routes guard could not find the app directory at ${appDir}. ` +
        "It resolves from the build's cwd, so run next build from apps/shell.",
    );
  }

  const leaked = collectPageFiles(appDir)
    .filter((file) => rendersSignInGate(appDir, file))
    .map((file) => routeFromFile(appDir, file))
    .filter((route) => !isDisallowedForCrawlers(route) && !PUBLIC_WITH_SIGNIN_PROMPT.includes(route));

  if (leaked.length > 0) {
    const routes = Array.from(new Set(leaked)).sort();
    throw new Error(
      "These routes render a sign-in gate but are still crawlable, so they leak into " +
        `robots.txt and sitemap.xml as soft-404s: ${routes.join(", ")}. ` +
        "Add each one to CRAWLER_DISALLOW in apps/shell/lib/seo-routes.ts. " +
        "If a route is genuinely public and only shows an inline sign-in prompt " +
        "(a comment box on public content, say), add it to PUBLIC_WITH_SIGNIN_PROMPT there instead.",
    );
  }
}
