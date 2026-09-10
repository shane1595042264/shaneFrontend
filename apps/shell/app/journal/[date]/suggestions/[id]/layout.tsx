import type { Metadata } from "next";
import { JournalAccessGate } from "@/components/journal/journal-access-gate";

const SITE_URL = "https://shanejli.com";

// SHAN-464: generateMetadata rather than a static object so the page can read
// its own params and self-canonicalize. As a title-only static export it
// inherited alternates.canonical from app/journal/layout.tsx and claimed to be
// a duplicate of the journal index.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string; id: string }>;
}): Promise<Metadata> {
  const { date, id } = await params;
  return {
    title: "Suggestion — Journal — Shane",
    alternates: {
      canonical: `${SITE_URL}/journal/${encodeURIComponent(date)}/suggestions/${encodeURIComponent(id)}`,
    },
  };
}

// SHAN-475: the journal is invite-only, so every read this page makes 403s for
// a non-member. Gating at the layout turns that into the same request-access
// card the entry page shows, instead of a dead form.
export default function JournalSuggestionDetailLayout({ children }: { children: React.ReactNode }) {
  return <JournalAccessGate>{children}</JournalAccessGate>;
}
