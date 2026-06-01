import type { Metadata } from "next";

const TITLE = "Practice — Shane";
const DESCRIPTION = "Fitbod-style practice sessions for knowledge items — strikes, locations, and progress.";
const URL = "https://shanejli.com/practice";

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
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
