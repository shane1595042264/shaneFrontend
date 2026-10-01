// apps/shell/lib/markdown-headings.ts
// SHAN-542: heading slugs and anchor ids for rendered markdown bodies.
// SHAN-543: the only implementation of them. /docs used to have its own in
// lib/docs/headings.ts; that module is gone and this one serves both surfaces.
//
// Duplicate handling is the reason there is one rather than two. The old /docs
// version slugged purely from heading text and matched a rendering heading to
// its id the same way, which works only for as long as no page repeats a
// heading. The first real blog post broke exactly that -- "Version A: the
// render pipeline (verified)" appears twice -- and the failure was silent and
// three-part: two elements with one id is invalid HTML, the fragment always
// resolves to the first so the second section is unreachable, and the /docs
// table of contents dropped the repeat's row rather than showing it.
//
// So a repeat gets a GitHub-style numeric suffix and headings resolve by their
// position in the source instead of by their text. That makes the collision
// impossible rather than merely unlikely, which matters most for /docs: the
// root CLAUDE.md requires a content module to be edited in the same commit as
// the API it documents, and "Errors" / "Response" / "Rate limits" are the
// headings an API reference page repeats first.
//
// The markdown source is never mutated -- feeds, /docs/raw/<slug>, /llms.txt
// and the API keep serving the exact body bytes.

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
 * becomes a nav row. Setext headings (`Title` over `====`) are not recognised --
 * nothing in this app's markdown writes them, and one that appeared would simply
 * render without an anchor.
 *
 * `includeH1` (SHAN-543) is what lets /docs share this. A blog post body has no
 * title heading of its own by the time it gets here -- the echoed title is
 * stripped (SHAN-540) and any remaining `#` is demoted to an h2 by
 * markdownComponents -- so `#` is content and belongs in the nav. A doc body is
 * the opposite: every page in lib/docs/content opens with `# <Title>`, which IS
 * the page title, renders as a real `<h1>`, and gets no anchor because the /docs
 * heading overrides cover h2/h3 only. Counting it would put a row at the top of
 * all 13 navs pointing at an id that does not exist on the page.
 */
export function extractBodyHeadings(
  body: string,
  { includeH1 = true }: { includeH1?: boolean } = {},
): MarkdownHeading[] {
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
    if (!includeH1 && match[1].length === 1) return;

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

/**
 * Id for the span that wraps a heading's own text, which the heading then points
 * `aria-labelledby` at (SHAN-550).
 *
 * The anchored headings on /blog and /docs put a self-link inside the heading,
 * and that link carries a descriptive `aria-label` so a screen reader's link
 * list is not 25 rows reading "Link to this section" (SHAN-542). But accessible
 * name computation walks a heading's descendants and takes each one's own
 * accessible name, and `aria-label` wins over content, so that label was being
 * concatenated into the heading's name: Chrome reported
 * `heading "Endpoints Link to section: Endpoints"` for 27 of the 29 headings on
 * the first real blog post and 7 of the 8 on /docs/journal-api. Heading
 * navigation is how a screen reader moves through a 29-section document, so
 * every row of that list repeated itself. Naming the heading from the text span
 * alone overrides the whole computation and leaves the link's label reaching only
 * the link.
 *
 * `aria-labelledby` rather than `aria-label={text}` on the heading so the name
 * still comes from the rendered text nodes: a browser's translate feature
 * rewrites content and not attributes, and an attribute copy is a second source
 * of truth for a string that is already on the page.
 *
 * The `_` is what makes this collision-proof rather than merely unlikely.
 * slugifyHeading() drops everything outside [a-z0-9 -], so no heading id can
 * ever contain an underscore, and `endpoints_label` therefore cannot be some
 * other heading's id. A `-label` suffix could: a doc with an "Endpoints label"
 * heading would slug to exactly that.
 */
export function headingLabelId(id: string): string {
  return `${id}_label`;
}

/** Plain text of a hast node -- what the heading renders as, minus any markup. */
export function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(nodeText).join("");
}
