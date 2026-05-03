"use client";

import { diffLines } from "diff";

interface Props {
  before: string;
  after: string;
}

export function SuggestionDiff({ before, after }: Props) {
  const parts = diffLines(before, after);
  return (
    <pre className="overflow-x-auto rounded border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5">
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            part.added
              ? "block bg-emerald-500/10 text-emerald-300"
              : part.removed
              ? "block bg-red-500/10 text-red-300"
              : "block text-gray-300"
          }
        >
          {part.added ? "+ " : part.removed ? "- " : "  "}
          {part.value.replace(/\n$/, "")}
        </span>
      ))}
    </pre>
  );
}
