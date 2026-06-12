import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suggestions — Journal — Shane",
};

export default function JournalSuggestionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
