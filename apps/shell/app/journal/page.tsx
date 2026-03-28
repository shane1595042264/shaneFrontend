import type { DiaryEntry } from "@shane/types";
import { fetchEntries } from "@/lib/journal-api";
import { EntryTimeline } from "@/components/journal/entry-timeline";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function JournalPage() {
  let entries: DiaryEntry[] = [];
  let total = 0;

  try {
    const data = await fetchEntries({ limit: PAGE_SIZE });
    entries = data.entries;
    total = data.total;
  } catch {
    // fall through with empty defaults
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Journal</h1>
        <p className="text-gray-400 text-sm">Daily entries and reflections.</p>
      </div>
      <EntryTimeline entries={entries} total={total} limit={PAGE_SIZE} />
    </div>
  );
}
