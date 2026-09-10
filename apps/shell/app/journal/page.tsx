// app/journal/page.tsx
import type { Metadata } from "next";
import { JournalIndexHeader } from "@/components/journal/journal-index-header";
import { JournalSearchList } from "@/components/journal/journal-search-list";
import { JournalAccessGate } from "@/components/journal/journal-access-gate";

// The journal is invite-only (SHAN-475). This document is public and cached, so
// it deliberately carries no entry data and no Blog structured data: the list is
// fetched client-side, with the viewer's JWT, inside the access gate. The route
// is also in CRAWLER_DISALLOW, but noindex is the belt to that suspenders.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Nothing on this page depends on backend data any more, so it prerenders once
// and stays static. The revalidate stays only so a redeploy-free copy change
// still lands within 5 minutes.
export const revalidate = 300;

// Server-side seed for "today"; JournalSearchList swaps in the viewer's own
// timezone as soon as auth-context resolves. Chicago is the site default.
function getTodayChicago(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function JournalPage() {
  const today = getTodayChicago();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JournalAccessGate>
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Shane Journal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A wiki-style journal, private to invited members. Any member can write the
            first entry for a date; the author approves edits suggested by others.
          </p>
        </header>

        <JournalIndexHeader />

        {/* entries=[] + initialLoadFailed: there is no server seed to hand over, so
            the list loads itself on mount through the authenticated client path. */}
        <JournalSearchList entries={[]} today={today} initialLoadFailed />
      </JournalAccessGate>
    </div>
  );
}
