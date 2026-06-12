import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Append — Journal — Shane",
};

export default function JournalAppendLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
