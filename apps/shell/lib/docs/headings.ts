// apps/shell/lib/docs/headings.ts
// SHAN-453: heading slugs for the Documentation element.
//
// /docs/[slug] renders its markdown with ReactMarkdown, which emits bare
// <h2>/<h3> with no id, so no section of the developer docs could be linked to.
// Both sides of the fix -- the "On this page" nav and the rendered headings --
// derive the id from the *same plain text* via slugifyHeading(), so every TOC
// link resolves by construction instead of by two implementations agreeing by
// luck. Ids are a pure function of the heading text (no positional counter),
// because the renderer sees headings one at a time and must not depend on the
// order React happens to call it in.
//
// The markdown source is never mutated: /docs/raw/<slug>, /llms.txt and
// /llms-full.txt keep serving the exact bytes in lib/docs/content/*.
//
// SHAN-542: the slug rule and the inline stripper moved to
// lib/markdown-headings.ts when the blog needed anchors too, so a doc fragment
// and a post fragment are spelled by one implementation. slugifyHeading is
// re-exported here because callers of this module import it from here.

import { slugifyHeading, stripInlineMarkdown } from "@/lib/markdown-headings";

export { slugifyHeading };

export interface DocHeading {
  /** 2 for `##`, 3 for `###`. Only these two levels get anchors. */
  depth: 2 | 3;
  /** Heading text with inline markdown stripped -- what the browser renders. */
  text: string;
  /** URL fragment. */
  id: string;
}

/**
 * Every `##`/`###` heading in a doc body, in document order.
 *
 * Fenced blocks are skipped so a `# comment` line inside a curl sample never
 * becomes a TOC row.
 */
export function extractDocHeadings(body: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let inFence = false;
  let fenceChar = "";

  for (const line of body.split("\n")) {
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
      } else if (fence[1][0] === fenceChar) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    const match = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const text = stripInlineMarkdown(match[2]);
    headings.push({
      depth: match[1].length as 2 | 3,
      text,
      id: slugifyHeading(text) || `section-${headings.length + 1}`,
    });
  }

  return headings;
}

/**
 * The subset of headings safe to list in a table of contents: two headings with
 * the same text share an id, so only the first is linkable. Dropping the later
 * ones keeps every TOC row pointing at the heading it names. (No page in
 * lib/docs/content repeats a heading today; this is a guard for future ones.)
 */
export function tocHeadings(headings: DocHeading[]): DocHeading[] {
  const seen = new Set<string>();
  return headings.filter((h) => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
}

/**
 * Id for a heading being rendered, matched to extractDocHeadings() output by
 * plain text so both sides agree even if the stripping rules change. Falls back
 * to slugifying the text for a heading that isn't in the list (unreachable for
 * our own content, but keeps it anchored rather than id-less).
 */
export function docHeadingId(headings: DocHeading[], text: string): string {
  return headings.find((h) => h.text === text)?.id ?? slugifyHeading(text);
}
