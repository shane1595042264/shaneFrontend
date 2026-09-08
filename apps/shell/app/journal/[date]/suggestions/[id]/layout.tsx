import type { Metadata } from "next";

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

export default function JournalSuggestionDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
