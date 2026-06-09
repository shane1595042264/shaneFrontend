import { NextResponse, type NextRequest } from "next/server";

// SHAN-224 + SHAN-231: edge middleware that turns soft-404s into real HTTP 404s
// for /journal/:date and /trips/:slug. Two layers:
//   1. SHAN-224 fast path — synchronous regex check for /journal/:date. Returns
//      404 for structurally-invalid dates (e.g. /journal/not-a-date,
//      /journal/2026-99-99, /journal/2024-02-30) with no backend round-trip.
//   2. SHAN-231 backend existence check — for valid-format journal dates and
//      single-segment /trips/:slug paths, HEAD the backend with a 1.5s timeout
//      and return 404 on backend-404. On timeout/network error we fail open
//      (pass through to Next), which preserves the pre-fix soft-404 UI rather
//      than introducing a new Railway-down failure mode.
//
// Why this is needed: the Page+generateMetadata+notFound() pipeline in
// Next 15.5.14 streams the not-found.tsx body with HTTP 200, so crawlers see
// indexable empty pages despite robots:noindex. SHAN-224 attempts 1–3 inside
// the page layer all failed; doing the 404 at the edge bypasses the broken
// status-propagation path entirely.

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://shanebackend-production.up.railway.app";

const BACKEND_TIMEOUT_MS = 1500;

function isValidJournalDate(value: string): boolean {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // Round-trip against Date.UTC so Feb 30, Nov 31, etc. don't slip through.
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

const JOURNAL_NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Not Found — Journal — Shane</title>
<meta name="robots" content="noindex,follow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { background:#000; color:#9ca3af; font-family:ui-sans-serif,system-ui,sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; padding:6rem 1rem; }
  p { font-size:0.875rem; font-style:italic; margin:0; }
  a { color:#60a5fa; font-size:0.875rem; text-decoration:none; }
  a:hover { color:#93c5fd; }
</style>
</head>
<body>
<p>No entry for this date.</p>
<a href="/journal">&larr; Back to journal</a>
</body>
</html>`;

const TRIP_NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Not Found — Trips — Shane</title>
<meta name="robots" content="noindex,follow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { background:#000; color:#9ca3af; font-family:ui-sans-serif,system-ui,sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; padding:6rem 1rem; }
  p { font-size:0.875rem; font-style:italic; margin:0; }
  a { color:#60a5fa; font-size:0.875rem; text-decoration:none; }
  a:hover { color:#93c5fd; }
</style>
</head>
<body>
<p>Trip not found.</p>
<a href="/trips">&larr; Back to trips</a>
</body>
</html>`;

// Sibling routes under /journal/ that are NOT date entries — must be
// allowlisted so middleware doesn't 404 them. Matches the folder layout in
// app/journal/ (feed.xml/route.ts, inbox/page.tsx, opengraph-image.tsx).
const JOURNAL_NON_DATE_SEGMENTS = new Set(["feed.xml", "inbox", "opengraph-image"]);

// Set of YYYY-MM-DD strings that could be "today" for any viewer worldwide:
// UTC today plus the day on either side covers UTC-12 through UTC+14. We pass
// these through to the page even when no entry exists yet, so the "Write
// today's entry" CTA can land on a writeable page instead of an edge 404.
function viewerTodayCandidates(): Set<string> {
  const dayMs = 86_400_000;
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return new Set([iso(now - dayMs), iso(now), iso(now + dayMs)]);
}

// Sibling routes under /trips/ that are NOT trip detail pages. Matches the
// folder layout in app/trips/ (new/page.tsx is the creation form; groups/
// is the SHAN-268 trip-planning groups feature with its own index page).
// Anything in this set passes through to Next.js routing instead of being
// HEAD-probed against /api/trips/:segment (which would 404).
const TRIPS_NON_SLUG_SEGMENTS = new Set(["new", "groups", "opengraph-image"]);

function notFoundResponse(html: string): NextResponse {
  return new NextResponse(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Returns true if backend says the resource exists, false on backend-404, null
// on timeout/network error (caller should fail open).
async function backendExists(path: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
    if (res.status === 404) return false;
    return true;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only intercept single-segment paths under /journal/. Deeper paths like
  // /journal/[date]/suggestions or /journal/inbox/foo fall through to Next's
  // normal routing.
  const journalMatch = pathname.match(/^\/journal\/([^\/]+)\/?$/);
  if (journalMatch) {
    const segment = journalMatch[1];
    if (JOURNAL_NON_DATE_SEGMENTS.has(segment)) return NextResponse.next();
    if (!isValidJournalDate(segment)) {
      // SHAN-224 fast path: structurally invalid date, no backend call needed.
      return notFoundResponse(JOURNAL_NOT_FOUND_HTML);
    }
    // "Write today's entry" lands on a date that legitimately has no backend
    // entry yet — the user is about to create it. Skip the existence check
    // for any date that could be "today" in any viewer's timezone so the
    // page renders the write CTA instead of an edge 404.
    if (viewerTodayCandidates().has(segment)) return NextResponse.next();
    // SHAN-231: format is valid — ask the backend whether an entry exists.
    const exists = await backendExists(`/api/journal/entries/${segment}`);
    if (exists === false) return notFoundResponse(JOURNAL_NOT_FOUND_HTML);
    return NextResponse.next();
  }

  // Only intercept single-segment paths under /trips/.
  const tripMatch = pathname.match(/^\/trips\/([^\/]+)\/?$/);
  if (tripMatch) {
    const segment = tripMatch[1];
    if (TRIPS_NON_SLUG_SEGMENTS.has(segment)) return NextResponse.next();
    // SHAN-231: no URL-pattern check is possible — every slug is alphanumeric-
    // with-dashes, real or fake. Ask the backend.
    const exists = await backendExists(
      `/api/trips/${encodeURIComponent(segment)}`
    );
    if (exists === false) return notFoundResponse(TRIP_NOT_FOUND_HTML);
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/journal/:path*", "/trips/:path*"],
};
