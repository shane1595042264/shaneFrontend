import { NextResponse, type NextRequest } from "next/server";

// SHAN-224: edge middleware that turns soft-404s into real HTTP 404s for
// structurally-invalid /journal/:date URLs (e.g. /journal/not-a-date,
// /journal/2026-99-99, /journal/2024-02-30). Two prior attempts to fix this
// inside the Page+generateMetadata pipeline failed — see Jira for the
// 2026-05-28 and 2026-05-30 post-mortems. Returning the 404 at the edge
// bypasses the broken Next.js 15.5.14 status-propagation path entirely.
//
// Scope: invalid-format dates only. Valid-format-no-entry (/journal/2024-01-15)
// still falls through to the page, where it renders the friendly write-CTA UX
// and ships HTTP 200 with robots:noindex (intentional product decision).

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

const NOT_FOUND_HTML = `<!DOCTYPE html>
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

// Sibling routes under /journal/ that are NOT date entries — must be
// allowlisted so middleware doesn't 404 them. Matches the folder layout in
// app/journal/ (feed.xml/route.ts, inbox/page.tsx, opengraph-image.tsx).
const JOURNAL_NON_DATE_SEGMENTS = new Set(["feed.xml", "inbox", "opengraph-image"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Only intercept single-segment paths under /journal/. Deeper paths like
  // /journal/[date]/suggestions or /journal/inbox/foo fall through to Next's
  // normal routing.
  const match = pathname.match(/^\/journal\/([^\/]+)\/?$/);
  if (!match) return NextResponse.next();
  const segment = match[1];
  if (JOURNAL_NON_DATE_SEGMENTS.has(segment)) return NextResponse.next();
  if (isValidJournalDate(segment)) return NextResponse.next();
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export const config = {
  matcher: "/journal/:path*",
};
