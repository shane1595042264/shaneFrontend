// The journal went invite-only in SHAN-475. A feed is by definition an
// unauthenticated pull — there is no viewer to check membership against — so
// the only correct answer is that this endpoint no longer exists. Kept as a
// route (rather than deleted) so the URL returns a real 404 instead of falling
// through to /journal/[date] and soft-404ing at HTTP 200, and so subscribers
// on the old feed see their reader mark it dead rather than silently stall.
export const dynamic = "force-static";

export function GET() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
