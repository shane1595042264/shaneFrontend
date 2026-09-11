import type { Metadata } from "next";

// Title separator follows the site's "—" convention (matches courses/trips).
// The canonical here cascades to /blog/[slug], so that page re-declares its own
// (SHAN-464: `alternates` replaces rather than merges, and a segment layout's
// canonical is inherited by every nested route that doesn't override it).
export const metadata: Metadata = {
  title: "Blog — Shane",
  description:
    "Shane's public blog: long-form writing on software, travel, and whatever else stuck.",
  alternates: { canonical: "https://shanejli.com/blog" },
  openGraph: {
    title: "Blog — Shane",
    description:
      "Shane's public blog: long-form writing on software, travel, and whatever else stuck.",
    url: "https://shanejli.com/blog",
    siteName: "Shane — Periodic Table of Life",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
