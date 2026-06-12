import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit — Journal — Shane",
};

export default function JournalEditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
