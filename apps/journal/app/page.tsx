import type { DiaryEntry } from "@shane/types";
import { fetchEntries } from "@/lib/api";
import { EntryTimeline } from "@/components/entry-timeline";

export default async function HomePage() {
  let entries: DiaryEntry[];
  try {
    entries = await fetchEntries();
  } catch {
    entries = [];
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Journal</h1>
        <p className="text-gray-400 text-sm">Daily entries and reflections.</p>
      </div>
      <EntryTimeline entries={entries} />
    </div>
  );
}
