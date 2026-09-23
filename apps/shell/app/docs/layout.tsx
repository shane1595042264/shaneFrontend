import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — Shane",
  description:
    "Developer documentation for the shanejli.com APIs: auth, journal, courses, trips, knowledge, and conventions.",
  alternates: { canonical: "https://shanejli.com/docs" },
  // No `images` key on purpose: the opengraph-image.tsx file convention emits
  // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
  // and naming the route here would collapse all of that to one bare URL. See
  // lib/og-image-guard.ts, which fails the build if it comes back.
  openGraph: {
    title: "Documentation — Shane",
    description: "Developer documentation for the shanejli.com APIs.",
    url: "https://shanejli.com/docs",
    siteName: "Shane — Periodic Table of Life",
  },
  twitter: { card: "summary_large_image" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
