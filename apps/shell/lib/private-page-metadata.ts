import type { Metadata } from "next";

const SITE_URL = "https://shanejli.com";

/**
 * Metadata for a signed-in-only page nested under an element layout (SHAN-675).
 *
 * The pages under /practice and /settings are client components, so they cannot
 * export metadata themselves, and without a layout of their own they inherited
 * everything from the element layout: every tab read "Practice — Shane" or
 * "Settings — Shane", and every page declared the parent as its canonical
 * (SHAN-464), which for /settings is a 307 rather than a page.
 *
 * `path` is the route as served, segments already URI-encoded by the caller.
 * The noindex mirrors app/blog/new/layout.tsx: these routes are in
 * CRAWLER_DISALLOW, but robots.txt is a request, not a guarantee.
 */
export function privatePageMetadata(title: string, path: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE_URL}${path}` },
  };
}
