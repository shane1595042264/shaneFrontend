import type { Metadata } from "next";

/** Validate YYYY-MM-DD format. Mirrors isValidDate in journal/[date]/page.tsx. */
function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/** Human-readable long date, e.g. "Monday, January 15, 2024". */
function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Build the browser-tab title for a nested journal action page (edit / append /
 * suggest / suggestions / history). Prefixes the entry's date so multiple open
 * editing tabs across different days stay distinguishable, matching the
 * generateMetadata pattern in journal/[date]/page.tsx. Falls back to the plain
 * "<action> — Journal — Shane" title when the [date] segment isn't a valid
 * YYYY-MM-DD.
 */
export function journalActionMetadata(action: string, date: string): Metadata {
  const suffix = `${action} — Journal — Shane`;
  if (!isValidDate(date)) {
    return { title: suffix };
  }
  return { title: `${formatLongDate(date)} — ${suffix}` };
}
