/**
 * SHAN-477: same-origin launch paths for hosted courses.
 *
 * Every course Shane hosts himself is registered under the Railway fallback
 * hostname below. Corporate DNS filters (Cisco Umbrella on the PMG network,
 * confirmed by screenshot on the ticket) block that FQDN outright under
 * "Newly Seen Domains", so the Launch course button was a dead end from work.
 * The app is fine; the hostname is what gets filtered.
 *
 * So don't hand the browser a second hostname. Hosted courses launch through
 * `/learn/...` on shanejli.com and `next.config.ts` rewrites that back to the
 * Railway origin - the same move SHAN-458 made for `/api/...`. One
 * already-trusted hostname, and no new domain for a filter to flag.
 *
 * The database keeps the canonical origin URL as the course's unique
 * registration key. Only the browser-facing href is rewritten; the backend
 * classifier still fetches the canonical URL server-side, where no corporate
 * DNS sits in the path.
 */

/** Railway fallback host for the supermassive-courses service. */
export const COURSE_HOST = "supermassive-courses-production.up.railway.app";

/**
 * Maps a hosted-course URL to its same-origin `/learn/...` path. Any URL on a
 * different host - a course registered somewhere else entirely - is returned
 * untouched so it still launches directly.
 */
export function courseLaunchUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.host !== COURSE_HOST) return url;

  const match = parsed.pathname.match(/^\/courses\/(.+)$/);
  if (!match) return url;

  // Drop the origin's trailing slash: the rewrite re-adds it when it proxies,
  // and leaving it here would cost a Next trailing-slash redirect hop first.
  const rest = match[1].replace(/\/+$/, "");
  if (!rest) return url;

  return `/learn/${rest}${parsed.search}${parsed.hash}`;
}
