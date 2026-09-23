// apps/shell/lib/og-image-guard.ts
//
// BUILD-TIME GUARD. Walks app/ and fails the build if a page or layout names an
// `opengraph-image` route inside its metadata `images` array.
//
// Why that is a bug and not a preference. Next generates five tags from an
// app/**/opengraph-image.tsx module on its own -- og:image, og:image:alt,
// og:image:type, og:image:width, og:image:height -- reading them from the
// module's `alt`, `contentType` and `size` exports, and it appends a content
// hash to the URL (/opengraph-image?5050121889082026). Setting
// `openGraph.images` suppresses all of that and emits one bare og:image
// pointing at the path you typed. Three things break at once:
//
//  1. No :width/:height, so LinkedIn, Slack and Discord cannot reserve the
//     1200x630 box before fetching the bytes; the card renders small or the
//     surrounding layout reflows once it arrives.
//  2. No :alt, so the share card is unlabelled everywhere it is read aloud.
//  3. No content hash, so the URL is byte-identical before and after the card
//     is redrawn and every social scraper keeps serving its cached copy of the
//     old design forever. This is the expensive one: SHAN-519 redrew the root
//     card and the routes that hard-coded the path would have gone on
//     promising the retired periodic-table image indefinitely.
//
// SHAN-518 found this and fixed "/" alone, leaving a comment in app/page.tsx
// noting that every sibling layout still had it. Nothing made that comment
// actionable, so it stayed true for a month and cost a second ticket
// (SHAN-522) to sweep thirteen layouts and four detail pages. This turns the
// note into an error message, the way SHAN-494 did for the Elements Directory
// docs rule and SHAN-497 did for CRAWLER_DISALLOW coverage.
//
// There is deliberately no escape hatch. Naming the convention route is never
// the right call: a segment that wants a different card should add its own
// app/<segment>/opengraph-image.tsx, which the convention then picks up with
// the full tag set. `images` pointing at anything else -- a static file in
// public/, a remote URL, an object with explicit width/height -- is untouched
// by this guard, because those cases carry their own metadata and have no
// convention to suppress.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation fails `npm run build` and can never affect a production request.
import fs from "node:fs";
import path from "node:path";

/**
 * Strips comments before matching, so that the very explanation of this rule --
 * the "No `images` key on purpose" note now sitting above `openGraph` in
 * seventeen files, which spells out the forbidden pattern in prose -- does not
 * trip the guard it documents.
 *
 * Same two-step as lib/seo-routes-guard.ts: block comments first (which also
 * covers the JSX braces-slash-star form), then line comments only where the
 * `//` is not preceded by a colon, so an `https://` inside a string literal
 * does not truncate its line.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

function collectMetadataFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMetadataFiles(full, found);
    } else if (entry.name === "page.tsx" || entry.name === "layout.tsx") {
      found.push(full);
    }
  }
  return found;
}

/**
 * Locals in this module bound to a string literal containing
 * `opengraph-image`, so the indirection that three detail pages used --
 * ``const ogImagePath = `/trips/${slug}/opengraph-image`;`` and then
 * `images: [ogImagePath]` -- is caught as readily as the literal form. Without
 * this the guard would have passed the exact code it was written to prevent.
 */
function ogImageLocals(source: string): string[] {
  const names: string[] = [];
  const binding = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[`"'][^`"']*opengraph-image[^`"']*[`"']/g;
  for (const match of source.matchAll(binding)) names.push(match[1]);
  return names;
}

/** True when this file hands an opengraph-image route to a metadata `images` key. */
function namesConventionRoute(source: string): boolean {
  const clean = stripComments(source);
  const locals = ogImageLocals(clean);
  // `[^\]]*` keeps each match inside one array literal, and a negated class
  // matches newlines on its own, so this spans the several lines these arrays
  // are usually formatted across without needing the `s` flag (which the
  // shared tsconfig's target predates anyway).
  for (const match of clean.matchAll(/images:\s*\[([^\]]*)\]/g)) {
    const contents = match[1];
    if (contents.includes("opengraph-image")) return true;
    if (locals.some((name) => new RegExp(`\\b${name}\\b`).test(contents))) return true;
  }
  return false;
}

/**
 * Throws if any route names its own share-card route in metadata. Called from
 * next.config.ts; `appDir` is resolved there from the build's cwd.
 */
export function assertNoHardCodedOgImages(appDir: string): void {
  if (!fs.existsSync(appDir)) {
    throw new Error(
      `og-image guard could not find the app directory at ${appDir}. ` +
        "It resolves from the build's cwd, so run next build from apps/shell.",
    );
  }

  const offenders = collectMetadataFiles(appDir)
    .filter((file) => namesConventionRoute(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(appDir, file).split(path.sep).join("/"))
    .sort();

  if (offenders.length > 0) {
    throw new Error(
      "These files name an opengraph-image route in their metadata `images` array: " +
        `${offenders.join(", ")}. ` +
        "That collapses the five og:image tags the file convention emits down to one " +
        "bare URL, dropping :alt, :type, :width, :height and the content hash that " +
        "busts social scrapers' caches when the card is redrawn (SHAN-518, SHAN-522). " +
        "Delete the `images` key and let app/**/opengraph-image.tsx supply it. " +
        "If the segment needs a different card, give it its own opengraph-image.tsx.",
    );
  }
}
