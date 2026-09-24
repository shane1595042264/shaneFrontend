import { HOME_LINK, publicNavLinks, type NavLink } from "@/lib/nav-links";

/**
 * The 404 document middleware.ts returns from the edge (SHAN-528).
 *
 * These responses are built as strings rather than rendered by Next because
 * they are produced in middleware, which runs before routing and so never
 * reaches app/layout.tsx. That is the whole reason this file exists: the five
 * branches in middleware.ts each carried their own hand-written copy of the
 * same document — identical CSS, identical head, differing only in a title, a
 * sentence and one href — so every one of them independently missed the site
 * chrome the layout would otherwise have given them.
 *
 * Two consequences that this builder fixes rather than re-copies:
 *
 *   - There was no NavBar and exactly one link on the page, pointing back at
 *     the index the visitor was already trying to get past. SHAN-526 derived
 *     the NavBar from the element registry precisely so that "a visitor
 *     landing on /courses/pi2-heist from search" had somewhere to go; a
 *     visitor landing on a *dead* /courses/<slug> is the same person one
 *     character later, and they were still stranded. The link list below comes
 *     from the same `publicNavLinks()` the nav and app/sitemap.ts share, so
 *     the three cannot disagree and a new public element joins this page with
 *     no edit here.
 *
 *   - There was no heading element at all — the body was a <p> and an <a>.
 *
 * Edge-runtime safety was checked, not assumed: lib/nav-links.ts imports only
 * lib/element-registry.ts and lib/seo-routes.ts, element-registry imports the
 * thirteen app/<element>/manifest.ts modules, and every one of those is a
 * single `import type { ElementConfig }` plus a data literal. Nothing here
 * pulls in React or any runtime dependency.
 */
export interface EdgeNotFoundOptions {
  /** Document <title>, e.g. "Not Found — Courses — Shane". */
  title: string;
  /** The <h1>. Short — it sits above `message`, which carries the detail. */
  heading: string;
  /** One sentence naming what was missing. */
  message: string;
  /** Where the visitor most likely meant to be: the index they came through. */
  backHref: string;
  /** Label for `backHref`, e.g. "Back to courses" (the arrow is added here). */
  backLabel: string;
}

/**
 * Minimal HTML escaping for values interpolated into the document.
 *
 * Every call site today passes a module constant, so nothing attacker-
 * controlled reaches this. It is here because a builder that takes strings and
 * emits markup should not depend on its callers staying that way, and because
 * the apostrophe in copy like "doesn't exist" is a real escaping case already.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Colours are literals rather than Tailwind classes because this document
 * ships no stylesheet — middleware returns it before any asset pipeline is
 * involved. They track the real site tokens: #0a0a0a is `--background` from
 * app/globals.css (the copied blocks used #000, which is close but not the
 * page the visitor was on), #ededed is `--foreground`, #9ca3af is gray-400 and
 * #60a5fa is blue-400. Measured against #0a0a0a: #ededed 16.9:1, #9ca3af
 * 7.8:1, #60a5fa 7.8:1, the #93c5fd hover 11.0:1 — all clear of the 4.5:1
 * floor the dark-only theme holds itself to. lib/contrast-guard.ts enforces
 * the Tailwind-class half of that rule and cannot see raw CSS, so anything
 * added here has to be checked by hand the same way.
 */
const STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    background: #0a0a0a;
    color: #ededed;
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .brand {
    color: #ededed;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    text-decoration: none;
  }
  .brand:hover { opacity: 0.8; }
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 4rem 1.5rem;
    text-align: center;
  }
  h1 { font-size: 1.125rem; font-weight: 600; margin: 0; color: #ededed; }
  .message { font-size: 0.875rem; font-style: italic; margin: 0; color: #9ca3af; }
  a { color: #60a5fa; font-size: 0.875rem; text-decoration: none; }
  a:hover { color: #93c5fd; }
  .elsewhere { margin: 1.5rem 0 0; display: flex; flex-direction: column; gap: 0.75rem; align-items: center; }
  .elsewhere-label { font-size: 0.75rem; color: #9ca3af; margin: 0; text-transform: uppercase; letter-spacing: 0.06em; }
  .elsewhere ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    justify-content: center;
  }
`;

/**
 * Every public route, minus the one the primary link already points at.
 *
 * Recomputed per call rather than cached at module scope so the filter can
 * depend on `backHref`; `publicNavLinks()` is a filter-and-sort over a static
 * array, and this runs only on a 404.
 */
function elsewhereLinks(backHref: string): NavLink[] {
  return [HOME_LINK, ...publicNavLinks()].filter(
    (link) => link.href !== backHref,
  );
}

export function renderEdgeNotFound({
  title,
  heading,
  message,
  backHref,
  backLabel,
}: EdgeNotFoundOptions): string {
  const elsewhere = elsewhereLinks(backHref)
    .map(
      (link) =>
        `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="robots" content="noindex,follow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${STYLES}</style>
</head>
<body>
<header><a class="brand" href="/">Shane.</a></header>
<main>
<h1>${escapeHtml(heading)}</h1>
<p class="message">${escapeHtml(message)}</p>
<p><a href="${escapeHtml(backHref)}">&larr; ${escapeHtml(backLabel)}</a></p>
<nav class="elsewhere" aria-label="Site">
<p class="elsewhere-label">Elsewhere on the site</p>
<ul>${elsewhere}</ul>
</nav>
</main>
</body>
</html>`;
}
