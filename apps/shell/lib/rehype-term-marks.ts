// apps/shell/lib/rehype-term-marks.ts
// SHAN-712: wraps words that have a knowledge card in <dfn data-term-id>
// elements, in the hast tree react-markdown renders, the same way
// rehype-note-marks wraps noted text (and for the same reason: the marks are
// React's elements, with React's handlers). <dfn> is only the hast tag, picked
// because markdown never produces one; components/notes/marks maps it to
// TermMark, which renders a span.
//
// Runs after rehype-note-marks. A word the reader has a note on (their own
// cached Explain included) is inside a <mark> and is left alone: their note is
// the better answer there.

import type { TermIndex } from "@/lib/knowledge-terms";

interface HNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
}

export interface TermMarks {
  index: TermIndex | null;
  /** A card's own page does not underline the card. */
  exclude: string | null;
}

/**
 * Text under these is never a term: code reads literally, a link already goes
 * somewhere, a heading is a title rather than a mention, and a note mark is
 * the reader's own.
 */
const SKIP = new Set(["code", "pre", "a", "h1", "h2", "h3", "h4", "h5", "h6", "mark", "dfn", "button", "kbd", "svg"]);

export function rehypeTermMarks(options: TermMarks) {
  const { index, exclude } = options;
  return (tree: HNode) => {
    if (!index) return;
    // Only the first mention of each term in a body is marked, as a glossary
    // or a wiki would: the fifth "TLS" in a post needs no underline.
    const used = new Set<string>(exclude ? [exclude] : []);

    const visit = (node: HNode) => {
      const kids = node.children;
      if (!kids) return;
      let out: HNode[] | null = null;
      kids.forEach((child, i) => {
        if (child.type === "element") {
          if (!SKIP.has(child.tagName ?? "")) visit(child);
          out?.push(child);
          return;
        }
        const value = child.type === "text" ? (child.value ?? "") : "";
        const hits = value
          ? index.find(value).filter((h) => {
              if (used.has(h.id)) return false;
              used.add(h.id);
              return true;
            })
          : [];
        if (hits.length === 0) {
          out?.push(child);
          return;
        }
        out ??= kids.slice(0, i);
        let at = 0;
        for (const h of hits) {
          if (h.start > at) out.push({ type: "text", value: value.slice(at, h.start) });
          out.push({
            type: "element",
            tagName: "dfn",
            properties: { dataTermId: h.id },
            children: [{ type: "text", value: value.slice(h.start, h.end) }],
          });
          at = h.end;
        }
        if (at < value.length) out.push({ type: "text", value: value.slice(at) });
      });
      if (out) node.children = out;
    };

    visit(tree);
  };
}
