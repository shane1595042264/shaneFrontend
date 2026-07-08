import type { Metadata } from "next";

const TITLE = "Skincare — Shane";
const DESCRIPTION = "Morning & night skincare routines — track products, ordering, and streaks.";
const URL = "https://shanejli.com/skincare";

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

export default function SkincareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
