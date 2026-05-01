"use client";

import type { DiaryEntry } from "@shane/types";
import { DataHighlight } from "@/components/journal/data-highlight";
import { readingTimeMinutes } from "@/lib/journal-text";

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface EntryRendererProps {
  entry: DiaryEntry;
  isToday?: boolean;
  /** Search query whose case-insensitive matches should be highlighted in body text. */
  highlightQuery?: string;
}

export function EntryRenderer({ entry, isToday, highlightQuery }: EntryRendererProps) {
  const paragraphs = entry.content.split("\n").filter((p) => p.trim().length > 0);
  const readMinutes = readingTimeMinutes(entry.content);

  return (
    <article
      id={`entry-${entry.date}`}
      className="border-b border-white/8 pb-8 mb-8 last:border-0 last:mb-0"
    >
      <h2 className="text-base font-semibold text-white/80 tracking-tight mb-3 flex items-center gap-2 print:text-black print:text-lg">
        <time dateTime={entry.date}>{formatDateHeader(entry.date)}</time>
        {isToday && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
            Today
          </span>
        )}
        {readMinutes > 0 && (
          <span
            className="text-[11px] font-normal text-gray-500"
            aria-label={`${readMinutes} minute read`}
          >
            · {readMinutes} min read
          </span>
        )}
      </h2>

      <div className="space-y-3">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-gray-300 leading-relaxed text-sm print:text-black print:text-base">
            <DataHighlight text={para} highlightQuery={highlightQuery} />
          </p>
        ))}
      </div>
    </article>
  );
}
