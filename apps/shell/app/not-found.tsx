import Link from "next/link";
import { HOME_LINK, publicNavLinks } from "@/lib/nav-links";

/**
 * The in-app 404: every route that isn't intercepted by middleware.ts renders
 * this one (unrouted paths, and the `notFound()` calls in /blog/[slug],
 * /courses/[slug], /trips/[slug]).
 *
 * SHAN-528 brought it into line with the edge 404s in lib/edge-not-found.ts,
 * which are the same page for a visitor and had drifted apart from it. Two
 * fixes here:
 *
 *   - The only CTA said "Back to Table". That was true while the homepage was
 *     just the periodic table; SHAN-517 made a signed-out visitor open on the
 *     Portfolio view instead, and SHAN-526 relabelled `/` to "Home" in the nav
 *     for exactly that reason. This string was missed in that sweep, so the
 *     button named the half of the homepage the visitor does not land on.
 *   - The top heading was an <h2>, leaving the page with no <h1> at all.
 *
 * The route list is the same `publicNavLinks()` the NavBar and app/sitemap.ts
 * derive from the element registry, so all three agree about what is public
 * and a new public element appears here with no edit.
 *
 * No <main> wrapper: app/layout.tsx already renders `{children}` inside
 * `<main id="main-content">`, and a second landmark would be a nesting error.
 */
export default function NotFound() {
  const elsewhere = [HOME_LINK, ...publicNavLinks()].filter(
    (link) => link.href !== "/",
  );

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-gray-500/20 text-gray-300 text-xl font-bold">
          ?
        </div>
        <h1 className="text-lg font-semibold text-gray-100">Page not found</h1>
        <p className="text-sm text-gray-400">
          This page doesn&apos;t exist, or its link has changed.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-gray-200 rounded transition-colors"
        >
          Back to home
        </Link>
        {/*
          Hidden from `lg` up, which is exactly where components/nav-bar.tsx
          switches its link row on (`hidden lg:flex`). Above that breakpoint
          this list would be a second copy of the nav sitting a few hundred
          pixels below it; under it the nav is a closed hamburger, so this is
          the only set of routes on screen. The edge 404s carry the list
          unconditionally because they never get the NavBar at all — see
          lib/edge-not-found.ts.
        */}
        <nav aria-label="Site" className="pt-6 space-y-3 lg:hidden">
          <p className="text-xs uppercase tracking-wider text-gray-400">
            Elsewhere on the site
          </p>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {elsewhere.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
