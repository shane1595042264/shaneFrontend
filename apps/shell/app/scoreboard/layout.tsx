import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supermassive Scoreboard | Shane Li",
  description:
    "A friendly-competition arcade hall: games, live scores, and winners, recorded for posterity.",
  alternates: { canonical: "https://shanejli.com/scoreboard" },
  // No `images` key on purpose: the opengraph-image.tsx file convention emits
  // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
  // and naming the route here would collapse all of that to one bare URL. See
  // lib/og-image-guard.ts, which fails the build if it comes back.
  openGraph: {
    title: "Supermassive Scoreboard",
    description: "Friendly competitions, real games, real winners.",
    url: "https://shanejli.com/scoreboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Supermassive Scoreboard",
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
