import type { Metadata } from "next";

// Title separators use the site's existing "—" convention (matches
// trips/journal metadata); these strings must stay consistent with the
// established siteName.
export const metadata: Metadata = {
  title: "Courses — Shane",
  description:
    "A catalog of Shane's interactive lecture courses, auto-classified by AI, with ratings and reviews.",
  alternates: { canonical: "https://shanejli.com/courses" },
  // No `images` key on purpose: the opengraph-image.tsx file convention emits
  // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
  // and naming the route here would collapse all of that to one bare URL. See
  // lib/og-image-guard.ts, which fails the build if it comes back.
  openGraph: {
    title: "Courses — Shane",
    description:
      "A catalog of Shane's interactive lecture courses, auto-classified by AI, with ratings and reviews.",
    url: "https://shanejli.com/courses",
    siteName: "Shane — Periodic Table of Life",
  },
  twitter: { card: "summary_large_image" },
};

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
