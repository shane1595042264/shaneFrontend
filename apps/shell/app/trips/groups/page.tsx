import GroupsIndexClient from "./client";

// Server-component wrapper that explicitly opts out of build-time
// prerendering. force-dynamic on a server boundary makes the routes
// manifest list /trips/groups as a dynamic SSR route (ƒ) instead of a
// static one (○). Vercel's edge router otherwise resolved /trips/groups
// to a sibling /trips/[slug] dynamic match and served "Trip not found"
// — making this route dynamic puts both at the same precedence tier
// where Next.js's "static segment beats dynamic segment" rule applies.
export const dynamic = "force-dynamic";

export default function GroupsIndexPage() {
  return <GroupsIndexClient />;
}
