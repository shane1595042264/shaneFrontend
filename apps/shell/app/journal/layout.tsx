import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Journal — Shane",
  description:
    "Shane Li's daily journal — workouts, code, travel, and the texture of ordinary days.",
  alternates: {
    canonical: "https://shanejli.com/journal",
    types: {
      "application/rss+xml": "/journal/feed.xml",
    },
  },
  openGraph: {
    title: "Journal — Shane",
    description:
      "Shane Li's daily journal — workouts, code, travel, and the texture of ordinary days.",
    url: "https://shanejli.com/journal",
    siteName: "Shane — Periodic Table of Life",
    type: "website",
    images: ["/journal/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Journal — Shane",
    description:
      "Shane Li's daily journal — workouts, code, travel, and the texture of ordinary days.",
    images: ["/journal/opengraph-image"],
  },
};

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden h-[calc(100dvh-57px)] print:block print:h-auto print:overflow-visible">
      <div className="flex-1 overflow-hidden px-3 md:px-6 py-4 md:py-6 print:overflow-visible print:p-0">
        {children}
      </div>
    </div>
  );
}
