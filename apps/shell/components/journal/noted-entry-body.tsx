"use client";

import { memo } from "react";
import { EntryBody } from "@/components/journal/entry-body";
import { useNotesFor } from "@/components/journal/inline-notes";
import type { MarkdownHeading } from "@/lib/markdown-headings";

/**
 * Memoized because a body re-render re-parses its markdown, and the parents of
 * these bodies re-render for reasons that have nothing to do with the text
 * (an append's edit state, the TOC). Notes come from NotesProvider's data
 * context, whose arrays are stable until a note is added or removed.
 */
const MemoBody = memo(EntryBody);

/**
 * SHAN-577: one part of a journal date (the entry or an append) with its inline
 * notes. `data-note-target` is how a selection finds which part it is in, and
 * the value is the anchor target a new note is saved with.
 */
export function NotedEntryBody({
  target,
  content,
  headings,
}: {
  target: string;
  content: string;
  headings?: MarkdownHeading[];
}) {
  const notes = useNotesFor(target);
  return (
    <div data-note-target={target}>
      <MemoBody content={content} headings={headings} notes={notes} />
    </div>
  );
}
