import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox — Journal — Shane",
};

export default function JournalInboxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
