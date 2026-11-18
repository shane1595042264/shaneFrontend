import type { Components, Options } from "react-markdown";
import { NoteMark } from "@/components/notes/inline-notes";
import { TermMark } from "@/components/notes/knowledge-terms";
import { rehypeNoteMarks, type MarkableNote } from "@/lib/rehype-note-marks";
import { rehypeTermMarks, type TermMarks } from "@/lib/rehype-term-marks";

/**
 * The marks a reading body draws over its markdown: the reader's notes
 * (SHAN-577) and, after them, knowledge terms (SHAN-712), which skip any word
 * a note already covers. Every notes-capable body (blog post, journal entry,
 * course text, lesson card) goes through these two, so they mark the same way.
 * Not a client module on purpose: PostBody also renders on the server.
 */

type Plugins = NonNullable<Options["rehypePlugins"]>;
const NONE: Plugins = [];

export function markPlugins(notes?: MarkableNote[], terms?: TermMarks): Plugins {
  const hasNotes = !!notes?.length;
  const hasTerms = !!terms?.index;
  if (!hasNotes && !hasTerms) return NONE;
  const plugins: Plugins = [];
  if (hasNotes) plugins.push([rehypeNoteMarks, { notes }]);
  if (hasTerms) plugins.push([rehypeTermMarks, terms]);
  return plugins;
}

export function markComponents(base: Components | undefined, notes?: MarkableNote[], terms?: TermMarks): Components | undefined {
  const hasNotes = !!notes?.length;
  const hasTerms = !!terms?.index;
  if (!hasNotes && !hasTerms) return base;
  return {
    ...base,
    ...(hasNotes ? { mark: NoteMark } : null),
    ...(hasTerms ? { dfn: TermMark } : null),
  };
}
