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

/**
 * The visible body text of a trip's HTML, whitespace-collapsed and truncated
 * on a word boundary to at most `max` characters plus an ellipsis. Returns ""
 * when the document has no body text, so callers can fall back.
 */
export function tripSnippet(html: string, max = 155): string {
  const text = decodeEntities(
    html
      // Whole-element drops first: their contents are not body text, and
      // stripping only the tags would leave the page title, raw CSS
      // ("@page { size: A4 }") or script source in the snippet.
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
      .replace(/<(title|style|script|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
