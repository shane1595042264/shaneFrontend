import type { Metadata } from "next";

const TITLE = "Veil — Twitch chat in your eyeline";
const DESCRIPTION =
  "A lightweight Windows overlay that keeps Twitch chat readable on your own screen without blocking the game.";
const URL = "https://shanejli.com/veil";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "Shane — Periodic Table of Life",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function VeilLayout({ children }: { children: React.ReactNode }) {
  return children;
}
