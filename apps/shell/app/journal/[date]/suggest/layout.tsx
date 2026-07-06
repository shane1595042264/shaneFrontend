import type { Metadata } from "next";
import { journalActionMetadata } from "@/lib/journal-action-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  return journalActionMetadata("Suggest", date);
}

export default function JournalSuggestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
