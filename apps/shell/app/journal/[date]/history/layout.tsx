import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "History — Journal — Shane",
};

export default function JournalHistoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
