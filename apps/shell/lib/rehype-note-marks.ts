// apps/shell/lib/rehype-note-marks.ts
// SHAN-577: wraps the text each inline note is pinned to in <mark> elements,
// inside the hast tree react-markdown renders. Doing it here rather than
// painting over the DOM afterwards keeps the marks in React's tree: they are
// ordinary elements with ordinary event handlers (the hover popover), and a
// re-render can never find a DOM it did not create.
//
// A note can cross element boundaries (a phrase half in bold), so one note can
// become several <mark>s, each carrying the same id. Notes can overlap, so a
// piece of text covered by two notes carries both ids. Whitespace-only pieces
// are never wrapped: the text between two paragraphs is a newline sitting
// directly in the block flow, and a <mark> there would be an inline element
// between blocks (or, between list items, invalid HTML).

import { findAnchor, indexText, type NoteAnchor } from "@/lib/journal-notes";

interface HNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
}

export interface MarkableNote {
  id: string;
  anchor: Pick<NoteAnchor, "quote" | "prefix" | "suffix">;
}

/**
 * hast-util-to-jsx-runtime drops whitespace-only text directly inside these,
 * so the DOM never has it. Skipping it here keeps both sides counting the
 * same characters.
 */
const TABLE_PARENTS = new Set(["table", "thead", "tbody", "tfoot", "tr"]);

/** A ```mermaid block renders as a diagram (lib/markdown-mermaid); its source is not page text. */
function isMermaid(node: HNode): boolean {
  if (node.tagName !== "pre") return false;
  const code = node.children?.find((c) => c.type === "element");
  const cls = code?.properties?.className;
  return Array.isArray(cls) && cls.includes("language-mermaid");
}

export function rehypeNoteMarks(options: { notes?: MarkableNote[] } = {}) {
  const notes = options.notes ?? [];
  return (tree: HNode) => {
    if (notes.length === 0) return;

    const texts: { node: HNode; parent: HNode }[] = [];
    const walk = (node: HNode, parent: HNode | null) => {
      if (node.type === "text") {
        if (!parent) return;
        if (TABLE_PARENTS.has(parent.tagName ?? "") && !(node.value ?? "").trim()) return;
        texts.push({ node, parent });
        return;
      }
      if (node.type === "element" && isMermaid(node)) return;
      for (const child of node.children ?? []) walk(child, node);
    };
    walk(tree, null);

    const { norm, normToRaw } = indexText(texts.map((t) => t.node.value ?? "").join(""));
    const ranges: { id: string; start: number; end: number }[] = [];
    for (const note of notes) {
      const hit = findAnchor(norm, note.anchor);
      if (hit) ranges.push({ id: note.id, start: normToRaw[hit[0]], end: normToRaw[hit[1] - 1] + 1 });
    }
    if (ranges.length === 0) return;

    const replacements = new Map<HNode, Map<HNode, HNode[]>>();
    let offset = 0;
    for (const { node, parent } of texts) {
      const value = node.value ?? "";
      const from = offset;
      const to = offset + value.length;
      offset = to;
      const local = ranges.filter((r) => r.start < to && r.end > from);
      if (local.length === 0) continue;

      const cuts = new Set([0, value.length]);
      for (const r of local) {
        cuts.add(Math.max(0, r.start - from));
        cuts.add(Math.min(value.length, r.end - from));
      }
      const points = [...cuts].sort((a, b) => a - b);
      const pieces: HNode[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        if (b <= a) continue;
        const text = value.slice(a, b);
        const ids = local.filter((r) => r.start - from < b && r.end - from > a).map((r) => r.id);
        pieces.push(
          ids.length > 0 && text.trim()
            ? {
                type: "element",
                tagName: "mark",
                properties: { dataNoteIds: ids.join(" ") },
                children: [{ type: "text", value: text }],
              }
            : { type: "text", value: text }
        );
      }
      let forParent = replacements.get(parent);
      if (!forParent) replacements.set(parent, (forParent = new Map()));
      forParent.set(node, pieces);
    }

    for (const [parent, forParent] of replacements) {
      parent.children = (parent.children ?? []).flatMap((child) => forParent.get(child) ?? [child]);
    }
  };
}
