import type { Metadata } from "next";

// Same "<Page> — Shane" title and siteName as every other segment: an
// openGraph object here replaces the root one rather than merging with it.
// One description for search and share cards (SHAN-691): the cards used to
// carry a shorter hand-copied variant that had drifted from this one.
const DESCRIPTION =
  "A friendly-competition arcade hall: games, live scores, and winners, recorded for posterity.";

export const metadata: Metadata = {
  title: "Supermassive Scoreboard — Shane",
  description: DESCRIPTION,
  alternates: { canonical: "https://shanejli.com/scoreboard" },
  // No `images` key on purpose: the opengraph-image.tsx file convention emits
  // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
  // and naming the route here would collapse all of that to one bare URL. See
  // lib/og-image-guard.ts, which fails the build if it comes back.
  openGraph: {
    title: "Supermassive Scoreboard — Shane",
    description: DESCRIPTION,
    url: "https://shanejli.com/scoreboard",
    siteName: "Shane — Periodic Table of Life",
  },
  twitter: {
    card: "summary_large_image",
    title: "Supermassive Scoreboard — Shane",
    description: DESCRIPTION,
  },
};

export default function ScoreboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
