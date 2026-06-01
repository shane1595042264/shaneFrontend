import type { Metadata } from "next";

const TITLE = "Trips — Shane";
const DESCRIPTION = "Travel itineraries — drop in an HTML file and it becomes its own page.";
const URL = "https://shanejli.com/trips";

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

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
