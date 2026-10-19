// apps/shell/lib/journal-notes.ts
// SHAN-577: inline notes. Where a note's anchor sits in rendered text, on both
// sides of the round trip:
//
//   capture  a DOM Range the reader selected -> {quote, prefix, suffix}
//   resolve  {quote, prefix, suffix} -> the character range to underline,
//            computed over the hast tree react-markdown is about to render
//
// The two sides read the same text through different trees, so the rules that
// keep them agreeing live here, once:
//
//  - Whitespace is collapsed to single spaces before anything is compared. The
//    DOM and hast disagree on whitespace (react-markdown drops whitespace-only
//    text inside tables, the browser's selection has its own ideas about line
//    breaks), and a note on "kernel ring buffer" should not care.
//  - Chrome the page adds is skipped: anything inside [data-anno-skip], which
//    is the heading self-links and rendered mermaid diagrams. hast never had
//    that text, so the DOM side must not count it either.
//  - The anchor is text plus context, never an offset. Offsets die on the first
//    edit above the note; a quote with 64 characters either side survives any
//    edit that leaves those words alone, and picks the right occurrence of a
//    word that appears twice.

export interface NoteAnchor {
  /** "entry" for the entry body, or the id of an append on the same entry. */
  target: string;
  quote: string;
  prefix: string;
  suffix: string;
}

export const CONTEXT_CHARS = 64;
export const MAX_QUOTE_CHARS = 1000;

const WS = /\s/;

/** Collapses whitespace runs to one space. The comparison form of any text here. */
export function collapse(text: string): string {
  return text.replace(/\s+/g, " ");
}

/**
 * The collapsed form of `raw`, plus the maps between the two. `rawToNorm[i]` is
 * where raw character i landed (every character of a whitespace run maps to
 * its single space); `normToRaw[j]` is the first raw character behind
 * collapsed character j.
 */
export function indexText(raw: string): { norm: string; rawToNorm: number[]; normToRaw: number[] } {
  const rawToNorm = new Array<number>(raw.length + 1);
  const normToRaw: number[] = [];
  let norm = "";
  let inRun = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (WS.test(ch)) {
      if (!inRun) {
        normToRaw.push(i);
        norm += " ";
        inRun = true;
      }
      rawToNorm[i] = norm.length - 1;
    } else {
      rawToNorm[i] = norm.length;
      normToRaw.push(i);
      norm += ch;
      inRun = false;
    }
  }
  rawToNorm[raw.length] = norm.length;
  return { norm, rawToNorm, normToRaw };
}

function commonSuffixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function commonPrefixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Where an anchor's quote sits in collapsed text, as [start, end), or null when
 * the quote is no longer there. Every occurrence is scored by how much of the
 * stored context still matches around it, and the best wins; a tie goes to the
 * earliest, which is also what a note on a phrase that appears once wants.
 */
export function findAnchor(norm: string, anchor: Pick<NoteAnchor, "quote" | "prefix" | "suffix">): [number, number] | null {
  const quote = collapse(anchor.quote).trim();
  if (!quote) return null;
  const prefix = collapse(anchor.prefix);
  const suffix = collapse(anchor.suffix);
  let best: [number, number] | null = null;
  let bestScore = -1;
  for (let at = norm.indexOf(quote); at !== -1; at = norm.indexOf(quote, at + 1)) {
    const end = at + quote.length;
    const score =
      commonSuffixLength(norm.slice(Math.max(0, at - prefix.length), at), prefix) +
      commonPrefixLength(norm.slice(end, end + suffix.length), suffix);
    if (score > bestScore) {
      best = [at, end];
      bestScore = score;
    }
  }
  return best;
}

/** Text nodes under `root` in document order, minus the page chrome hast never saw. */
export function textNodesOf(root: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      (node.parentElement?.closest("[data-anno-skip]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/**
 * Raw offset of a Range boundary within the concatenated text of `nodes`.
 *
 * A boundary inside one of the counted text nodes is the common case. A
 * boundary on an element (a triple-click selects whole blocks that way) or
 * inside skipped chrome is resolved by position instead: everything that ends
 * at or before the boundary point counts in full.
 */
function rawOffset(nodes: Text[], container: Node, offset: number): number {
  let total = 0;
  for (const node of nodes) {
    if (node === container) return total + Math.min(offset, node.data.length);
    total += node.data.length;
  }
  const point = document.createRange();
  point.setStart(container, offset);
  point.collapse(true);
  total = 0;
  for (const node of nodes) {
    if (point.comparePoint(node, node.data.length) > 0) break;
    total += node.data.length;
  }
  return total;
}

/**
 * The anchor for what the reader selected inside one note target, or null when
 * the selection is empty, all whitespace, or longer than a note is allowed to
 * cover. The quote is trimmed, so a selection that grabbed a trailing space or
 * the line break after a paragraph pins to the words alone.
 */
export function captureAnchor(target: string, container: Element, range: Range): NoteAnchor | null {
  const nodes = textNodesOf(container);
  if (nodes.length === 0) return null;
  const start = rawOffset(nodes, range.startContainer, range.startOffset);
  const end = rawOffset(nodes, range.endContainer, range.endOffset);
  if (end <= start) return null;
  const raw = nodes.map((n) => n.data).join("");
  const { norm, rawToNorm } = indexText(raw);
  let s = rawToNorm[start];
  let e = rawToNorm[end - 1] + 1;
  while (s < e && norm[s] === " ") s++;
  while (e > s && norm[e - 1] === " ") e--;
  const quote = norm.slice(s, e);
  if (!quote || quote.length > MAX_QUOTE_CHARS) return null;
  return {
    target,
    quote,
    prefix: norm.slice(Math.max(0, s - CONTEXT_CHARS), s),
    suffix: norm.slice(e, e + CONTEXT_CHARS),
  };
}

/**
 * SHAN-596: the words around a selection, for Explain.
 *
 * About 120 words before and 80 after, cut at the edge of the part the
 * selection is in. A word's sense is settled by its sentence and paragraph;
 * that span covers a paragraph or two on either side, which is enough to tell
 * "ring buffer" the data structure from a ring and a buffer, at roughly 300
 * tokens of prompt. More before than after because writing explains forward:
 * the setup for a term usually precedes it. The nearest heading above the
 * selection goes along too, since a paragraph alone can be vague about what
 * field it is in.
 */
export function captureContext(
  container: Element,
  range: Range,
  { wordsBefore = 120, wordsAfter = 80 }: { wordsBefore?: number; wordsAfter?: number } = {}
): { before: string; after: string; heading: string | undefined } {
  const nodes = textNodesOf(container);
  const raw = nodes.map((n) => n.data).join("");
  const start = rawOffset(nodes, range.startContainer, range.startOffset);
  const end = rawOffset(nodes, range.endContainer, range.endOffset);
  const before = collapse(raw.slice(0, start)).trim().split(" ").filter(Boolean).slice(-wordsBefore).join(" ");
  const after = collapse(raw.slice(end)).trim().split(" ").filter(Boolean).slice(0, wordsAfter).join(" ");

  let heading: string | undefined;
  for (const h of container.querySelectorAll("h1, h2, h3, h4")) {
    const precedes = h.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (!precedes) break;
    heading = collapse(textNodesOf(h).map((n) => n.data).join("")).trim() || undefined;
  }
  return { before, after, heading };
}
