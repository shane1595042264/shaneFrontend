import type { Metadata } from "next";

// Same "<Page> — Shane" title and siteName as every other segment: an
// openGraph object here replaces the root one rather than merging with it.
export const metadata: Metadata = {
  title: "Supermassive Scoreboard — Shane",
  description:
    "A friendly-competition arcade hall: games, live scores, and winners, recorded for posterity.",
  alternates: { canonical: "https://shanejli.com/scoreboard" },
  // No `images` key on purpose: the opengraph-image.tsx file convention emits
  // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
  // and naming the route here would collapse all of that to one bare URL. See
  // lib/og-image-guard.ts, which fails the build if it comes back.
  openGraph: {
    title: "Supermassive Scoreboard — Shane",
    description: "Friendly competitions, real games, real winners.",
    url: "https://shanejli.com/scoreboard",
    siteName: "Shane — Periodic Table of Life",
  },
  twitter: {
    card: "summary_large_image",
    title: "Supermassive Scoreboard — Shane",
    description: "Friendly competitions, real games, real winners.",
  },
};

export default function ScoreboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
