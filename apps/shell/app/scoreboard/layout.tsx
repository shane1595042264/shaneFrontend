import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supermassive Scoreboard | Shane Li",
  description:
    "A friendly-competition arcade hall: games, live scores, and winners, recorded for posterity.",
  alternates: { canonical: "https://shanejli.com/scoreboard" },
  openGraph: {
    title: "Supermassive Scoreboard",
    description: "Friendly competitions, real games, real winners.",
    url: "https://shanejli.com/scoreboard",
    images: ["/opengraph-image"],
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
