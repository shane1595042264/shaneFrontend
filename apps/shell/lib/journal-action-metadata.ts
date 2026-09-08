import type { Metadata } from "next";

const SITE_URL = "https://shanejli.com";

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
 * Build the metadata for a nested journal action page (edit / append / suggest /
 * suggestions / history): the browser-tab title plus a self-referential
 * canonical.
 *
 * The title prefixes the entry's date so multiple open editing tabs across
 * different days stay distinguishable, matching the generateMetadata pattern in
 * journal/[date]/page.tsx. It falls back to the plain "<action> — Journal —
 * Shane" title when the [date] segment isn't a valid YYYY-MM-DD.
 *
 * SHAN-464: the canonical is the reason `subpath` exists. Without it these
 * layouts inherit alternates.canonical from app/journal/layout.tsx, so every
 * sub-page declared itself a duplicate of the journal index — false for pages
 * with their own title and content, and actively harmful for /history and
 * /suggestions, which lib/seo-routes.ts deliberately keeps crawlable.
 */
export function journalActionMetadata(
  action: string,
  date: string,
  subpath: string,
): Metadata {
  const suffix = `${action} — Journal — Shane`;
  // Encoded so an invalid [date] segment (middleware edge-404s those before
  // Next renders, but the title path already guards for it) still yields a
  // well-formed URL rather than a broken canonical.
  const alternates = {
    canonical: `${SITE_URL}/journal/${encodeURIComponent(date)}/${subpath}`,
  };
  if (!isValidDate(date)) {
    return { title: suffix, alternates };
  }
  return { title: `${formatLongDate(date)} — ${suffix}`, alternates };
}
