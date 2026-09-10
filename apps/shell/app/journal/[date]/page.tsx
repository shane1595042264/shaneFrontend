import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivitySidebar } from "@/components/journal/activity-sidebar";
import { JournalAccessGate } from "@/components/journal/journal-access-gate";
import { JournalEntryView } from "@/components/journal/journal-entry-view";

interface PageProps {
  params: Promise<{ date: string }>;
}

/** Validate YYYY-MM-DD format */
function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// This document is public and edge-cached; the entry it frames is not. Since
// the journal went invite-only (SHAN-475) the metadata is derived purely from
// the URL — fetching the entry here would 403 anyway, and any snippet it
// produced would be a private body pinned into a shared cache. noindex for the
// same reason (the route is also in CRAWLER_DISALLOW).
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  const title = isValidDate(date)
    ? `${formatDate(date)} — Journal — Shane`
    : "Entry Not Found — Journal — Shane";
  return {
    title,
    description: "A private journal entry. Members only.",
    robots: { index: false, follow: false },
    // The layout advertises RSS/JSON feeds on its canonical; both are gone now,
    // so clear the inherited `types` rather than letting it cascade down here.
    alternates: { canonical: `https://shanejli.com/journal/${date}`, types: {} },
    openGraph: {
      title,
      description: "A private journal entry. Members only.",
      type: "article",
      url: `https://shanejli.com/journal/${date}`,
      siteName: "Shane — Periodic Table of Life",
      images: [`/journal/${date}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: "A private journal entry. Members only.",
      images: [`/journal/${date}/opengraph-image`],
    },
  };
}

export default async function JournalEntryPage({ params }: PageProps) {
  const { date } = await params;

  if (!isValidDate(date)) {
    notFound();
  }

  return (
    <JournalAccessGate>
      <JournalEntryView date={date} sidebar={<ActivitySidebar date={date} />} />
    </JournalAccessGate>
  );
}
