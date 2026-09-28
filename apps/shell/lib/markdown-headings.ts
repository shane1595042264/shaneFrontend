// apps/shell/lib/markdown-headings.ts
// SHAN-542: heading slugs and anchor ids for rendered markdown bodies.
//
// The slug rule and the inline-markdown stripper live here, shared with
// lib/docs/headings.ts (which re-exports slugifyHeading), so a doc anchor and a
// blog anchor can never be spelled by two different implementations.
//
// What this module adds on top of the /docs version is duplicate handling. The
// docs corpus is ours and repeats no heading, so lib/docs/headings.ts matches a
// rendering heading to its id by plain text. A post body is arbitrary markdown,
// and the first real post already breaks that: "Version A: the render pipeline
// (verified)" appears twice. Two elements with one id is invalid HTML and leaves
// the second section unreachable, so repeats get a GitHub-style numeric suffix
// and headings are resolved by their position in the source instead of by text.
//
// The markdown source is never mutated -- feeds, /blog/raw-equivalents and the
// API keep serving the exact body bytes.

/**
 * Fragment id for a heading. Lowercased, everything outside [a-z0-9 -] dropped,
 * whitespace collapsed to hyphens. `## 8. A failure (Get Better)` becomes
 * `8-a-failure-get-better`.
 *
 * Returns "" for a heading that is entirely punctuation; callers substitute a
 * positional id in that case.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Strips the inline markdown that shows up in headings so the result matches the
 * heading's rendered textContent. Handles code spans (`x`), links
 * ([text](url)), and emphasis markers. Deliberately not a full inline parser:
 * the cost of missing an exotic construct is a slug with a stray asterisk, not a
 * broken page.
 */
export function stripInlineMarkdown(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .trim();
}

export interface MarkdownHeading {
  /**
   * 1-based line of the `#` in the source body. The lookup key: an mdast
   * heading carries its position, mdast-util-to-hast copies it onto the hast
   * element, and react-markdown hands that element to the component as `node`.
   */
  line: number;
  /**
   * The heading tag that actually renders, which is not always the tag in the
   * source. lib/markdown-mermaid demotes a body `#` to an h2 (SHAN-540) because
   * the page around it already owns the document h1, so `#` and `##` both
   * record 2 here and only `###` records 3.
   */
  depth: 2 | 3;
  /** Heading text with inline markdown stripped -- what the browser renders. */
  text: string;
  /** URL fragment, unique across the body. */
  id: string;
}

/**
 * Every `#`/`##`/`###` heading in a markdown body, in document order, with an id
 * that is unique within the body.
 *
 * Deeper headings are left alone: `####` and below are subdivisions inside a
 * section a reader already navigated to, and anchoring them would make the nav
 * an outline of the whole document rather than a way into it.
 *
 * Fenced blocks are skipped so a `# comment` line inside a shell sample never
 * becomes a nav row. Setext headings (`Title` over `====`) are not recognised,
 * matching the /docs extractor -- nothing in this app's markdown writes them,
 * and one that appeared would simply render without an anchor.
 */
export function extractBodyHeadings(body: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const usedIds = new Set<string>();
  let inFence = false;
  let fenceChar = "";

  body.split("\n").forEach((line, index) => {
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
      } else if (fence[1][0] === fenceChar) {
        inFence = false;
      }
      return;
    }
    if (inFence) return;

    // Trailing hashes are ATX closing syntax, not content.
    const match = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (!match) return;

    const text = stripInlineMarkdown(match[2]);
    const base = slugifyHeading(text) || `section-${headings.length + 1}`;
    let id = base;
    // GitHub's rule for a repeated heading: append the number of times the base
    // has been seen. The first keeps the bare slug, so adding a duplicate later
    // in a post never changes the link someone already shared.
    for (let n = 2; usedIds.has(id); n += 1) id = `${base}-${n}`;
    usedIds.add(id);

    headings.push({
      line: index + 1,
      depth: match[1].length === 3 ? 3 : 2,
      text,
      id,
    });
  });

  return headings;
}

/** The shape react-markdown hands a component as `node`, narrowed to what we read. */
interface PositionedNode {
  position?: { start?: { line?: number } };
}

/**
 * Id for a heading being rendered.
 *
 * Keyed on the source line rather than on the heading's text, which is what lets
 * two identically-worded headings resolve to their own ids, and rather than on a
 * render-order counter, which would make the id depend on the order React
 * happens to call the heading component in.
 *
 * Falls back to the first heading with matching text, then to a bare slug, for a
 * node that arrives without a position. Neither should happen with the current
 * renderer; both keep the heading anchored rather than id-less if it does.
 */
export function bodyHeadingId(
  headings: MarkdownHeading[],
  node: unknown,
  text: string,
): string {
  const line = (node as PositionedNode | undefined)?.position?.start?.line;
  if (typeof line === "number") {
    const byLine = headings.find((h) => h.line === line);
    if (byLine) return byLine.id;
  }
  return headings.find((h) => h.text === text)?.id ?? slugifyHeading(text);
}

/** Plain text of a hast node -- what the heading renders as, minus any markup. */
export function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(nodeText).join("");
}
