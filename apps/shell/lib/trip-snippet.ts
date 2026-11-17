// apps/shell/lib/trip-snippet.ts
//
// SHAN-560. A plain-text summary of an uploaded trip's HTML, for the trip
// page's meta/og/twitter description, its JSON-LD and its share card.
//
// Trips are whole HTML documents, so the <head> has to go before the tags are
// stripped. Stripping tags alone keeps the text inside <title>, and every
// snippet opened with the page title, right under a heading that already said
// it. The page and the share card each carried a private copy of this
// function, which is how both shipped the same bug; keep it in one place.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  middot: "·",
  bull: "•",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  rarr: "→",
  larr: "←",
  times: "×",
  deg: "°",
  euro: "€",
};

function decodeEntities(text: string): string {
  // One pass, so "&amp;lt;" decodes to the literal "&lt;" and not to "<".
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

// SHAN-700: a block-level tag ends a sentence. Replacing every tag with a space
// ran the h1 into the line under it ("Full Itinerary Greece · Italy") and the
// subtitle into the meta line ("1 traveler Traveler: Juntao Li").
const BLOCK_TAG =
  /<\/?(?:address|article|aside|blockquote|br|caption|dd|details|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;
const BLOCK_BREAK = "\u0000";

// A block that already ends in punctuation, an emoji or a separator like "·"
// gets no extra period; one ending in a word, number or closing bracket does.
const NEEDS_PERIOD = /[\p{L}\p{N})\]"'”’]$/u;

const OPENERS: Record<string, string> = { "(": ")", "[": "]" };

// The word-boundary cut can land inside a parenthetical ("Greece (5…").
// Back off to before the last bracket the cut leaves open.
function dropUnclosedBracket(text: string): string {
  const open: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (OPENERS[text[i]]) open.push(i);
    else if (open.length && text[i] === OPENERS[text[open[open.length - 1]]]) open.pop();
  }
  return open.length && open[0] > 40 ? text.slice(0, open[0]) : text;
}

/**
 * The visible body text of a trip's HTML, whitespace-collapsed, with each
 * block (heading, paragraph, div, list item, cell) read as its own sentence.
 * Over `max` characters it ends on the last whole block that fits when that
 * keeps at least half the budget, otherwise on a word boundary plus an
 * ellipsis. Returns "" when the document has no body text, so callers can
 * fall back.
 */
export function tripSnippet(html: string, max = 155): string {
  const blocks = decodeEntities(
    html
      // Whole-element drops first: their contents are not body text, and
      // stripping only the tags would leave the page title, raw CSS
      // ("@page { size: A4 }") or script source in the snippet.
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
      .replace(/<(title|style|script|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(BLOCK_TAG, BLOCK_BREAK)
      .replace(/<[^>]*>/g, " "),
  )
    .split(BLOCK_BREAK)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let text = "";
  const blockEnds: number[] = [];
  for (const block of blocks) {
    text += `${text ? " " : ""}${block}${NEEDS_PERIOD.test(block) ? "." : ""}`;
    blockEnds.push(text.length);
  }
  if (text.length <= max) return text;

  const wholeBlocks = blockEnds.filter((end) => end <= max).pop();
  if (wholeBlocks !== undefined && wholeBlocks >= max / 2) return text.slice(0, wholeBlocks);

  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const words = dropUnclosedBracket(lastSpace > 40 ? cut.slice(0, lastSpace) : cut);
  return `${words.replace(/[\s.·|,;:—–-]+$/, "")}…`;
}
