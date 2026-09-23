import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivitySidebar } from "@/components/journal/activity-sidebar";
import { JournalAccessGate } from "@/components/journal/journal-access-gate";
import { JournalEntryView } from "@/components/journal/journal-entry-view";

interface PageProps {
  params: Promise<{ date: string }>;
}

// SHAN-512: DO NOT make this route ISR. It looks like the ideal candidate —
// the page body below is pure, the entry arrives client-side inside
// JournalAccessGate, and the metadata comment further down says the document
// is edge-cached — but ActivitySidebar is a *server* component and
// getActivities() in lib/api/activities.ts fetches with cache: "no-store".
// Adding revalidate + generateStaticParams was tried and shipped on c1ebd23;
// every /journal/<date> then 500'd in production with
//   Page changed from static to dynamic at runtime, reason: revalidate: 0
//   fetch .../api/activities/<date>
// and it was reverted in b4960dd. A single uncacheable fetch anywhere in the
// tree makes a static route throw at request time rather than fall back to
// dynamic. The route is correctly ƒ: it renders per-request backend data.
// Making it ISR would mean giving the activity sidebar a revalidate window,
// which is a deliberate staleness decision about a shared helper, not a
// caching tidy-up — scope it as its own ticket if it is ever wanted.

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
    // No `images` key on purpose: the opengraph-image.tsx file convention emits
    // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
    // and naming the route here would collapse all of that to one bare URL. See
    // lib/og-image-guard.ts, which fails the build if it comes back.
    openGraph: {
      title,
      description: "A private journal entry. Members only.",
      type: "article",
      url: `https://shanejli.com/journal/${date}`,
      siteName: "Shane — Periodic Table of Life",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: "A private journal entry. Members only.",
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
