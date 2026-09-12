// apps/shell/app/journal/activity/page.tsx
import type { Metadata } from "next";
import { JournalAccessGate } from "@/components/journal/journal-access-gate";
import { JournalActivityPageBody } from "@/components/journal/journal-activity-page-body";

// Same posture as the journal index (SHAN-475): the document is public and
// cached, the feed inside it is not. Nothing is fetched here — the rows load
// client-side with the viewer's JWT, inside the access gate. The route is in
// CRAWLER_DISALLOW too; noindex is the belt to that suspenders.
export const metadata: Metadata = {
  title: "Activity — Journal — Shane",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://shanejli.com/journal/activity", types: {} },
};

export default function JournalActivityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JournalAccessGate>
        <JournalActivityPageBody />
      </JournalAccessGate>
    </div>
  );
}
