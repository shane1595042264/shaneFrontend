// apps/shell/lib/main-landmark-guard.ts
//
// BUILD-TIME GUARD. Walks app/, components/ and packages/ui/src and fails the
// build if a `<main>` appears anywhere except app/layout.tsx.
//
// Why there can only ever be one. app/layout.tsx renders `{children}` inside
// `<main id="main-content">`, unconditionally, on every route. So a `<main>` in
// a segment layout, page, loading or error boundary is not a second landmark
// next to the first one -- it is nested *inside* it. That is invalid HTML
// (`main` is flow content and explicitly may not descend from another `main`),
// and it puts two overlapping entries called "main" in the landmark list, which
// is precisely the navigation shortcut the landmark exists to provide. The skip
// link in the layout targets #main-content, so the duplicate is also the half
// that no keyboard user can reach.
//
// app/not-found.tsx has documented the rule in a comment since it was written
// ("a second landmark would be a nesting error"), and SHAN-533 fixed the four
// element-bar layouts (knowledge, vocabulary, rng-capitalist, who-owes-me)
// after measuring document.querySelectorAll('main').length === 2 on prod. A
// comment in one file and a fix in four is not enforcement: SHAN-534 then found
// 19 more across 15 files, including /blog and /docs, which unlike those four
// are public and in the sitemap, so their duplicate landmark was the half that
// actually reached crawlers and screen readers at scale. This module is why the
// count can now only go down.
//
// The scope is `.tsx` deliberately, and that is load-bearing rather than
// incidental. lib/edge-not-found.ts also contains a `<main>`, and that one is
// CORRECT: it is the 404 document middleware.ts returns as a string (SHAN-528),
// and middleware runs before routing, so it never reaches app/layout.tsx and
// its `<main>` is the only one in that document. TypeScript rejects JSX in a
// `.ts` file, so a `<main>` outside a `.tsx` file is necessarily inside a
// template literal, which means a standalone document rather than something
// nested in the layout. Scoping by extension excludes that whole class by
// construction instead of carrying a name-based exemption for one file. If a
// genuine standalone document ever arrives as `.tsx` -- a global-error.tsx
// owning its own <html>, say, which does not exist today -- it will trip this
// guard, and the right answer then is to add it to `allowed` with a note, not
// to widen the rule.
//
// Comments are stripped before anything else because in this repo the prose
// outnumbers the markup: nine comments across not-found.tsx, the four SHAN-533
// layouts and who-owes-me/loading.tsx mention `<main>` while explaining exactly
// this rule, and a guard that flagged its own documentation would be deleted
// within a week.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation fails `npm run build` and can never affect a production request.
import fs from "node:fs";
import path from "node:path";

/**
 * Same two-step as lib/select-name-guard.ts, lib/og-image-guard.ts and
 * lib/seo-routes-guard.ts: block comments first, then line comments only where
 * the `//` is not preceded by a colon, so an `https://` inside a string literal
 * does not truncate its line.
 *
 * This also handles JSX comments for free, since `{/* ... *\/}` is a block
 * comment wrapped in braces and it is the inner block that carries the prose.
 *
 * Replacing comments with an equal run of newlines rather than "" keeps every
 * subsequent line number intact, which matters because the error message
 * reports `file:line` for a human to open.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => "\n".repeat((block.match(/\n/g) || []).length))
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

function collectTsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsxFiles(full, found);
    } else if (entry.name.endsWith(".tsx")) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Line numbers of every `<main>` opening tag in one file.
 *
 * `\b` after the tag name is what keeps a `<MainNav>`-style component out of
 * the results; the match is case-sensitive, so only the lowercase HTML element
 * can hit. A closing `</main>` is not counted separately -- one report per
 * element is what a human needs to find it.
 */
function mainLandmarkLines(source: string): number[] {
  const clean = stripComments(source);
  return [...clean.matchAll(/<main\b/g)].map(
    (match) => clean.slice(0, match.index).split("\n").length,
  );
}

/**
 * Throws if any `.tsx` file under `roots` contains a `<main>` outside
 * `allowedFile` (the root layout, which owns the site's single landmark).
 *
 * Called from next.config.ts, which resolves both from the build's cwd.
 */
export function assertSingleMainLandmark(roots: string[], allowedFile: string): void {
  const allowed = path.resolve(allowedFile);
  if (!fs.existsSync(allowed)) {
    throw new Error(
      `main-landmark guard could not find the root layout at ${allowed}. It ` +
        "resolves from the build's cwd, so run next build from apps/shell.",
    );
  }
  // Comment-stripped, the same way every other file is tested below. A raw
  // regex here would accept app/not-found.tsx, which contains the string
  // `<main>` only in the comment explaining why it has no <main> -- and the
  // guard would then go on to report the real landmark in layout.tsx as the
  // offender. One notion of "contains a <main>" per module.
  if (mainLandmarkLines(fs.readFileSync(allowed, "utf8")).length === 0) {
    throw new Error(
      `main-landmark guard expected the site's one <main> landmark in ${allowed} ` +
        "and found none. If the landmark moved, point this guard at its new home; " +
        "if it was deleted, the skip link in the layout now targets nothing.",
    );
  }

  const offenders: string[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      throw new Error(
        `main-landmark guard could not find ${root}. It resolves from the ` +
          "build's cwd, so run next build from apps/shell.",
      );
    }
    for (const file of collectTsxFiles(root)) {
      if (path.resolve(file) === allowed) continue;
      const source = fs.readFileSync(file, "utf8");
      if (!source.includes("<main")) continue;
      for (const line of mainLandmarkLines(source)) {
        offenders.push(`${path.relative(root, file).split(path.sep).join("/")}:${line}`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `These <main> elements nest inside the one in app/layout.tsx: ${offenders.sort().join(", ")}. ` +
        "That layout wraps {children} in <main id=\"main-content\"> on every route, so a " +
        "<main> in a page, layout, loading or error boundary is a nested landmark, not a " +
        "sibling: invalid HTML, and two overlapping \"main\" entries in the landmark list a " +
        "screen reader offers as a shortcut. SHAN-533 measured two of them on prod and " +
        "SHAN-534 swept 19 more. The fix is one word -- <main> becomes <div>, classes " +
        "untouched, since both are display:block and nothing here selects main by tag. A " +
        "component that feels like it owns the page's main region still does not: the " +
        "layout's landmark is already wrapping it.",
    );
  }
}
