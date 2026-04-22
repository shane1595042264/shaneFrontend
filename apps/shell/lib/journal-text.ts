const DATA_MARKER_RE = /\[\[data:[^|]+\|([^|]+)\|[\s\S]+?\]\]/g;

export function stripDataMarkers(text: string): string {
  return text.replace(DATA_MARKER_RE, "$1");
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
