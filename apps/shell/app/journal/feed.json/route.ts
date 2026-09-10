// Gone with /journal/feed.xml — see the comment there. The journal is
// invite-only, and a feed request carries no identity to authorize.
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
