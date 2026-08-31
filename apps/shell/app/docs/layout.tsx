import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — Shane",
  description:
    "Developer documentation for the shanejli.com APIs: auth, journal, courses, trips, knowledge, and conventions.",
  alternates: { canonical: "https://shanejli.com/docs" },
  openGraph: {
    title: "Documentation — Shane",
    description: "Developer documentation for the shanejli.com APIs.",
    url: "https://shanejli.com/docs",
    siteName: "Shane — Periodic Table of Life",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
