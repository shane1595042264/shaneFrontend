import type { DiaryEntry } from "@shane/types";
import { fetchEntries } from "@/lib/journal-api";
import { JournalDocument } from "@/components/journal/journal-document";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 500;

export default async function JournalPage() {
  let entries: DiaryEntry[] = [];

  try {
    const data = await fetchEntries({ limit: MAX_ENTRIES });
    entries = data.entries;
  } catch {
    // fall through with empty defaults
  }

  return <JournalDocument entries={entries} />;
}
