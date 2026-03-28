"use client";

import type { DiaryEntry } from "@shane/types";
import { DataHighlight } from "@/components/journal/data-highlight";

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
}

export function EntryRenderer({ entry }: EntryRendererProps) {
  const paragraphs = entry.content.split("\n").filter((p) => p.trim().length > 0);

  return (
    <article
      id={`entry-${entry.date}`}
      className="border-b border-white/8 pb-8 mb-8 last:border-0 last:mb-0"
    >
      <h2 className="text-base font-semibold text-white/80 tracking-tight mb-3">
        {formatDateHeader(entry.date)}
      </h2>

      <div className="space-y-3">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-gray-300 leading-relaxed text-sm">
            <DataHighlight text={para} />
          </p>
        ))}
      </div>
    </article>
  );
}
