const DATA_MARKER_RE = /\[\[data:[^|]+\|([^|]+)\|[\s\S]+?\]\]/g;

function stripDataMarkers(text: string): string {
  return text.replace(DATA_MARKER_RE, "$1");
}

// Images whose alt text is auto-generated junk (a filename like image.png,
// or the editor's fallback "pasted-image") would otherwise leave that token
// trailing the excerpt. Drop the whole image markdown for those; images with
// human-written alt fall through to the generic pass below and keep their alt.
const JUNK_IMAGE_ALT_RE =
  /!\[(?:|pasted-image|[^\]\n]*\.(?:png|jpe?g|gif|webp|svg|bmp|avif|heic|heif))\]\([^)]*\)/gi;

function stripJunkAltImages(text: string): string {
  return text.replace(JUNK_IMAGE_ALT_RE, "");
}

const MARKDOWN_PASSES: Array<[RegExp, string]> = [
  [/```[\s\S]*?```/g, " "],
  [/`([^`]+)`/g, "$1"],
  [/!\[([^\]]*)\]\([^)]*\)/g, "$1"],
  [/\[([^\]]+)\]\([^)]*\)/g, "$1"],
  [/^\s{0,3}#{1,6}\s+/gm, ""],
  [/^\s{0,3}>\s?/gm, ""],
  [/^\s*[-*+]\s+/gm, ""],
  [/^\s*\d+\.\s+/gm, ""],
  [/^\s*[-*_]{3,}\s*$/gm, ""],
  [/(\*\*|__)(.+?)\1/g, "$2"],
  [/(?<!\w)([*_])(?=\S)([^*_\n]+?)(?<=\S)\1(?!\w)/g, "$2"],
  [/~~(.+?)~~/g, "$1"],
];

export function stripMarkdown(text: string): string {
  if (!text) return "";
  let out = stripJunkAltImages(text);
  for (const [re, sub] of MARKDOWN_PASSES) out = out.replace(re, sub);
  return out;
}

// Comparison form for "is this heading just the title again?": inline markdown
// resolved, whitespace collapsed, case folded, and any trailing punctuation
// dropped so "All Behavioral questions" still matches "All Behavioral
// questions:". Deliberately conservative — it normalizes noise, it does not
// fuzzy-match, so two genuinely different strings never collide.
function headingKey(text: string): string {
  return stripMarkdown(text)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[.,:;!?'"()[\]{}‘’“”]+$/u, "")
    .trim();
}

/**
 * Drops a leading level-1 heading from `content` when it is just `title` again.
 *
 * Anything pasted out of a doc or an LLM answer opens with its own `# Title`,
 * and every page that renders one of these bodies already prints the title as
 * the document h1 directly above. Left alone that ships two identical h1s and
 * puts the title at the front of the excerpt, which then leads the meta
 * description, the OG and Twitter descriptions, the JSON-LD description and
 * the feed summary (SHAN-540).
 *
 * Scope is narrow on purpose:
 * - Level 1 only. A leading `## Title` is a real section heading, and removing
 *   it would be a guess about what the author meant.
 * - First block only. A mid-document heading that happens to repeat the title
 *   is the author's structure, not an artifact.
 * - Nothing happens if the document opens with a code fence, so a `#` that is
 *   a shell comment or a CSS id on line one of a fenced block is never eaten.
 *
 * Returns `content` untouched whenever it does not match, so every call site
 * can apply it unconditionally.
 */
export function stripLeadingTitleHeading(content: string, title: string): string {
  const source = content ?? "";
  const wanted = headingKey(title ?? "");
  if (!source.trim() || !wanted) return source;

  const lines = source.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  if (i >= lines.length) return source;

  const first = lines[i];
  if (/^\s{0,3}(?:```|~~~)/.test(first)) return source;

  // ATX: "# Title", with the optional closing run of hashes GFM allows.
  const atx = first.match(/^\s{0,3}#\s+(.*?)\s*#*\s*$/);
  if (atx && headingKey(atx[1]) === wanted) return dropThrough(lines, i);

  // Setext: the title on one line, "=====" underneath it.
  const underline = lines[i + 1];
  if (
    underline !== undefined &&
    /^\s{0,3}=+\s*$/.test(underline) &&
    headingKey(first) === wanted
  ) {
    return dropThrough(lines, i + 1);
  }

  return source;
}

/** Everything after line `last`, with the blank lines it left behind removed. */
function dropThrough(lines: string[], last: number): string {
  let next = last + 1;
  while (next < lines.length && lines[next].trim() === "") next += 1;
  return lines.slice(next).join("\n");
}

const ATX_HEADING_RE = /^\s{0,3}#{1,6}(?:\s|$)/;
const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
const QUOTE_RE = /^\s{0,3}>/;
// A setext underline ("===" or "---" under a line) or a thematic break. Either
// way the line ends whatever block is open and carries no text of its own.
const BLOCK_RULE_RE = /^\s{0,3}(?:=+|-+|([-*_])(?:\s*\1){2,})\s*$/;
const ENDS_IN_PUNCTUATION_RE = /[.!?…:;,]["'’”)\]*_]*$/u;

/**
 * The text of each markdown block (paragraph, heading, list item, quote), with
 * inline markdown stripped and whitespace collapsed. Lines of a soft-wrapped
 * paragraph stay in one block; anything markdown would render on its own line
 * starts a new one.
 */
function plainBlocks(content: string): string[] {
  const blocks: string[] = [];
  let open: string[] = [];
  let openIsQuote = false;
  const flush = () => {
    const text = stripMarkdown(open.join("\n")).replace(/\s+/g, " ").trim();
    if (text) blocks.push(text);
    open = [];
    openIsQuote = false;
  };

  const source = stripDataMarkers(content ?? "").replace(/```[\s\S]*?```/g, "\n\n");
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || BLOCK_RULE_RE.test(line)) {
      flush();
    } else if (ATX_HEADING_RE.test(line)) {
      flush();
      open.push(line);
      flush();
    } else if (QUOTE_RE.test(line)) {
      // "> a" then "> b" is one wrapped quote; a bare ">" is a blank line in it.
      if (!openIsQuote || !line.replace(QUOTE_RE, "").trim()) flush();
      open.push(line);
      openIsQuote = true;
    } else if (LIST_ITEM_RE.test(line)) {
      flush();
      open.push(line.replace(LIST_ITEM_RE, ""));
    } else {
      open.push(line);
    }
  }
  flush();
  return blocks;
}

/**
 * Plain-text excerpt of a markdown body, for meta descriptions, feed summaries
 * and list tiles.
 *
 * Built block by block rather than by collapsing every newline: a heading or a
 * list item has no closing punctuation, so flattening the whole body ran each
 * one into the text after it, and "## How to use this" over "- Every answer is
 * STAR" shipped as "How to use this Every answer is STAR" in the blog's meta
 * description and link previews (SHAN-552). Blocks that do not already end in
 * punctuation get a period before the next one.
 */
export function toPlainExcerpt(content: string, maxLen: number, ellipsis = "..."): string {
  const plain = plainBlocks(content).reduce(
    (out, block) => (!out ? block : `${out}${ENDS_IN_PUNCTUATION_RE.test(out) ? "" : "."} ${block}`),
    ""
  );
  // String iteration walks by Unicode codepoint (not UTF-16 code unit), so a cutoff
  // landing inside a surrogate pair (emoji, non-BMP CJK) keeps the whole character
  // instead of leaving a lone surrogate that renders as U+FFFD.
  const codepoints = Array.from(plain);
  return codepoints.length > maxLen
    ? codepoints.slice(0, maxLen).join("").trimEnd() + ellipsis
    : plain;
}

export function countWords(text: string): number {
  // Strip markdown the same way toPlainExcerpt does so control tokens (list
  // markers, heading hashes, blockquote markers, code fences, image/link URLs)
  // don't get counted as words and inflate reading time.
  const plain = stripMarkdown(stripDataMarkers(text ?? "")).trim();
  if (!plain) return 0;
  return plain.split(/\s+/).length;
}

/**
 * Minutes for an already-counted body. Split out from readingTimeMinutes for
 * blog posts (SHAN-541), which carry a denormalized `wordCount` from the
 * backend: a tile only ever receives a 500-char excerpt, so counting on the
 * client there pinned every post at the 1-minute floor no matter how long it
 * was. Both surfaces render this, from the same stored number, so the index
 * and the post itself cannot disagree.
 *
 * 0 words means "no count", and returns 0 so callers render nothing rather
 * than falling back to the floor and inventing a minute.
 */
export function readingTimeFromWords(words: number, wpm = 225): number {
  if (!Number.isFinite(words) || words <= 0) return 0;
  return Math.max(1, Math.ceil(words / wpm));
}

export function readingTimeMinutes(text: string, wpm = 225): number {
  return readingTimeFromWords(countWords(text), wpm);
}
