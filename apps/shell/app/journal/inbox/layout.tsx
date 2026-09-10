import type { Metadata } from "next";
import { JournalAccessGate } from "@/components/journal/journal-access-gate";

export const metadata: Metadata = {
  title: "Inbox — Journal — Shane",
};

// SHAN-475: the journal is invite-only, so every read this page makes 403s for
// a non-member. Gating at the layout turns that into the same request-access
// card the entry page shows, instead of a dead form.
export default function JournalInboxLayout({ children }: { children: React.ReactNode }) {
  return <JournalAccessGate>{children}</JournalAccessGate>;
}
