import type { Metadata } from "next";

// Invite-only since SHAN-475, so the description here is a description of the
// door, not of what is behind it, and there are no feed alternates left to
// advertise. Nested routes re-declare `alternates` (Next replaces rather than
// merges it), so the canonical below applies to /journal alone.
const DESCRIPTION = "Shane Li's private journal. Members only.";

export const metadata: Metadata = {
  title: "Journal — Shane",
  description: DESCRIPTION,
  alternates: {
    canonical: "https://shanejli.com/journal",
  },
  // No `images` key on purpose: the opengraph-image.tsx file convention emits
  // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
  // and naming the route here would collapse all of that to one bare URL. See
  // lib/og-image-guard.ts, which fails the build if it comes back.
  openGraph: {
    title: "Journal — Shane",
    description: DESCRIPTION,
    url: "https://shanejli.com/journal",
    siteName: "Shane — Periodic Table of Life",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Journal — Shane",
    description: DESCRIPTION,
  },
};

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-3 md:px-6 py-4 md:py-6 print:p-0">
      {children}
    </div>
  );
}
