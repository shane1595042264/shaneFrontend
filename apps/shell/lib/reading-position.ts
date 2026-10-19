// SHAN-597: where a reader is in a journal entry, measured so it survives a
// different screen.
//
// A pixel offset does not travel: the same entry on a phone is three times as
// tall as on a desktop. So a position is the text block sitting on the reading
// line plus how far down that block the line is, with the block's opening
// words to find it again if an edit moved it, and overall progress as the last
// resort when it cannot be found at all.

/** Where "currently reading" sits, as a fraction of the viewport. The contents rail uses the same line. */
export const READING_LINE = 0.25;

/** At or past this the entry counts as read. */
export const READ_THROUGH = 0.98;

/** Below this the reader is still at the top: nothing to resume, nothing to show. */
export const STARTED = 0.02;

/** Fired by the notes layer when a note or an explanation lands on a node. */
export const READING_MARK_EVENT = "journal:reading-mark";

export interface ReadingAnchor {
  block: number;
  offset: number;
  text: string;
}

export interface CapturedPosition {
  progress: number;
  anchor: ReadingAnchor;
}

// The outermost of these wins, so a list item is one block and so is a whole
// table, while a quote's paragraphs are each their own. Bare SVG is a mermaid
// diagram; an icon inside a paragraph is swallowed by the paragraph.
const BLOCK_SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,pre,table,hr,figure,img,svg";

const TEXT_CAP = 160;
const KEY_LEN = 48;

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

function textOf(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The opening words used to recognise a block again. */
function keyOf(text: string): string {
  return text.slice(0, KEY_LEN).toLowerCase();
}

/**
 * The readable blocks inside `root`, in document order. Note UI and anything
 * hidden are left out.
 *
 * Only the rendered text counts: the entry body and each append's body, which
 * are the `[data-note-target]` parts the notes layer already marks. Measured
 * across the whole article, each append's `<li>` was the outermost block, so a
 * whole append became one block whose opening words were its header ("5d ago ·
 * Juntao Li edit delete"), and that stops matching the next day.
 */
export function readingBlocks(root: Element): Element[] {
  const parts = root.querySelectorAll("[data-note-target]");
  const scopes = parts.length > 0 ? [...parts] : [root];
  const out: Element[] = [];
  for (const scope of scopes) {
    scope.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
      if (el.closest("[data-anno-skip]")) return;
      const outer = el.parentElement?.closest(BLOCK_SELECTOR);
      if (outer && scope.contains(outer)) return;
      if (el.getClientRects().length === 0) return;
      out.push(el);
    });
  }
  return out;
}

export function readingLineY(): number {
  return window.innerHeight * READING_LINE;
}

function progressAt(root: Element, y: number): number {
  const r = root.getBoundingClientRect();
  // Once the end of the entry is on screen there is nothing left to scroll to,
  // and on a short entry that is true from the start.
  if (r.bottom <= window.innerHeight + 1) return 1;
  return clamp((y - r.top) / Math.max(1, r.height), 0, 1);
}

function anchorFor(blocks: Element[], index: number, y: number): ReadingAnchor {
  const el = blocks[index];
  if (!el) return { block: 0, offset: 0, text: "" };
  const r = el.getBoundingClientRect();
  return {
    block: index,
    // Past 1 when the line sits in a gap below the block, such as a diagram
    // container the block list does not count.
    offset: round(clamp((y - r.top) / Math.max(1, r.height), 0, 100), 3),
    // Array.from so a cut never lands inside an emoji's surrogate pair.
    text: Array.from(textOf(el)).slice(0, TEXT_CAP).join(""),
  };
}

/**
 * Where the reading line is right now, or null when there is nothing to
 * measure: a detached article (replaced under a long-lived listener) has no
 * layout, and measuring it reads as "finished, at block 0".
 */
export function capturePosition(root: Element): CapturedPosition | null {
  if (!root.isConnected) return null;
  const y = readingLineY();
  const blocks = readingBlocks(root);
  if (blocks.length === 0) return null;
  let index = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].getBoundingClientRect().top <= y) index = i;
    else break;
  }
  return { progress: round(progressAt(root, y), 4), anchor: anchorFor(blocks, index, y) };
}

/**
 * The position of a node the reader just acted on (a note, an explanation):
 * as if the reading line ran through it.
 */
export function capturePositionAt(root: Element, node: Node): CapturedPosition | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el || !root.isConnected || !root.contains(el)) return null;
  const y = el.getBoundingClientRect().top;
  const blocks = readingBlocks(root);
  if (blocks.length === 0) return null;
  let index = blocks.findIndex((b) => b.contains(el));
  if (index < 0) {
    // Between blocks: take the last one that starts before it.
    index = 0;
    blocks.forEach((b, i) => {
      if (b.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) index = i;
    });
  }
  return { progress: round(progressAt(root, y), 4), anchor: anchorFor(blocks, index, y) };
}

/**
 * A saved block's opening words for display. The save cuts at a fixed length,
 * which usually lands mid-word, so cut back to a whole word and say so.
 */
export function readingSnippet(text: string): string {
  if (Array.from(text).length < TEXT_CAP) return text;
  const cut = text.lastIndexOf(" ");
  return (cut > 40 ? text.slice(0, cut) : text).replace(/[\s.,;:!?-]+$/, "") + "…";
}

/** Whether a saved position is worth scrolling to at all. */
export function isPastTheTop(pos: CapturedPosition): boolean {
  return pos.anchor.block > 0 || pos.anchor.offset > 0.5 || pos.progress > STARTED;
}

/** The scrollY that puts a saved position back on the reading line. */
export function scrollTargetFor(root: Element, pos: CapturedPosition): number {
  const y = readingLineY();
  const blocks = readingBlocks(root);
  const key = keyOf(pos.anchor.text);
  let el: Element | undefined = blocks[pos.anchor.block];
  // The block at that index is a different one now (an edit above it added or
  // removed a paragraph): look for the words instead.
  // A prefix match, so a block whose words were extended by an edit still
  // counts as the same block.
  if (key && (!el || !keyOf(textOf(el)).startsWith(key))) {
    el = blocks.find((b) => keyOf(textOf(b)).startsWith(key));
  }
  if (el) {
    const r = el.getBoundingClientRect();
    return Math.max(0, window.scrollY + r.top + pos.anchor.offset * r.height - y);
  }
  const r = root.getBoundingClientRect();
  return Math.max(0, window.scrollY + r.top + pos.progress * r.height - y);
}

/** Tell whoever is tracking this page that the reader just worked on `node`. */
export function markReadingAt(node: Node | null | undefined): void {
  if (!node || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(READING_MARK_EVENT, { detail: { node } }));
}
