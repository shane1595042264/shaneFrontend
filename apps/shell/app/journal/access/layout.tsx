import type { Metadata } from "next";
import { JournalAccessGate } from "@/components/journal/journal-access-gate";

export const metadata: Metadata = {
  title: "Access — Journal — Shane",
  // Owner-only management surface. /journal is already in CRAWLER_DISALLOW;
  // noindex is the belt to that suspenders, same as the journal index.
  robots: { index: false, follow: false },
};

// SHAN-476: gating at the layout means a signed-out or non-member visitor gets
// the familiar request-access card rather than an admin screen whose every
// fetch would 403. The page itself makes the finer owner-vs-member call.
export default function JournalAccessLayout({ children }: { children: React.ReactNode }) {
  return <JournalAccessGate>{children}</JournalAccessGate>;
}
