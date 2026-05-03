const DATA_MARKER_RE = /\[\[data:[^|]+\|([^|]+)\|[\s\S]+?\]\]/g;

export function stripDataMarkers(text: string): string {
  return text.replace(DATA_MARKER_RE, "$1");
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
  let out = text;
  for (const [re, sub] of MARKDOWN_PASSES) out = out.replace(re, sub);
  return out;
}

export function toPlainExcerpt(content: string, maxLen: number, ellipsis = "..."): string {
  const plain = stripMarkdown(stripDataMarkers(content ?? "")).replace(/\s+/g, " ").trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + ellipsis : plain;
}

export function countWords(text: string): number {
  const trimmed = stripDataMarkers(text).trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function readingTimeMinutes(text: string, wpm = 225): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / wpm));
}
