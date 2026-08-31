import type { Metadata } from "next";

// Title separators use the site's existing "—" convention (matches
// trips/journal metadata); these strings must stay consistent with the
// established siteName.
export const metadata: Metadata = {
  title: "Courses — Shane",
  description:
    "A catalog of Shane's interactive lecture courses, auto-classified by AI, with ratings and reviews.",
  alternates: { canonical: "https://shanejli.com/courses" },
  openGraph: {
    title: "Courses — Shane",
    description:
      "A catalog of Shane's interactive lecture courses, auto-classified by AI, with ratings and reviews.",
    url: "https://shanejli.com/courses",
    siteName: "Shane — Periodic Table of Life",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
};

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
