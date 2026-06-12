import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suggest — Journal — Shane",
};

export default function JournalSuggestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
