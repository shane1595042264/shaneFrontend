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
  openGraph: {
    title: "Journal — Shane",
    description: DESCRIPTION,
    url: "https://shanejli.com/journal",
    siteName: "Shane — Periodic Table of Life",
    type: "website",
    images: ["/journal/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Journal — Shane",
    description: DESCRIPTION,
    images: ["/journal/opengraph-image"],
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
