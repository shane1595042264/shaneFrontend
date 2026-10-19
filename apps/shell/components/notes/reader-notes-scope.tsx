"use client";

import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { readerNotesAdapter } from "@/components/notes/adapters";
import { NoteMark, NotesProvider, useNotesFor } from "@/components/notes/inline-notes";
import { PostBody } from "@/components/blog/post-body";
import type { ReaderSurface } from "@/lib/api/reader-notes";
import type { MarkdownHeading } from "@/lib/markdown-headings";
import { rehypeNoteMarks, type MarkableNote } from "@/lib/rehype-note-marks";

/**
 * SHAN-596: private inline notes and Explain on a public page (a blog post, a
 * knowledge card). A server page cannot hand a client provider an adapter
 * object, so it hands over the surface and the id and the adapter is built
 * here. Signed-out readers get the page exactly as before: no notes are
 * fetched and no toolbar appears.
 */
export function ReaderNotesScope({
  surface,
  resourceId,
  title,
  children,
}: {
  surface: ReaderSurface;
  resourceId: string;
  title?: string;
  children: ReactNode;
}) {
  const adapter = useMemo(() => readerNotesAdapter(surface, resourceId), [surface, resourceId]);
  return (
    <NotesProvider adapter={adapter} documentTitle={title}>
      {children}
    </NotesProvider>
  );
}

/**
 * Memoized: a body re-render re-parses its markdown, and the provider re-renders
 * on every hover. Its notes array is stable until a note is added or removed.
 */
const MemoPostBody = memo(PostBody);

/** A blog post body that can carry notes. Same markup as PostBody, inside the note target. */
export function NotedPostBody({ content, headings }: { content: string; headings?: MarkdownHeading[] }) {
  const notes = useNotesFor("body");
  return (
    <div data-note-target="body">
      <MemoPostBody content={content} headings={headings} notes={notes} />
    </div>
  );
}

const MemoMarkdown = memo(function NotedMarkdownInner({
  content,
  notes,
  components,
}: {
  content: string;
  notes: MarkableNote[];
  components?: Components;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={notes.length ? [[rehypeNoteMarks, { notes }]] : []}
      components={notes.length ? { ...components, mark: NoteMark } : components}
    >
      {content}
    </ReactMarkdown>
  );
});

/** Any markdown block that can carry notes, under the given target name. */
export function NotedMarkdown({
  target,
  content,
  components,
  className,
}: {
  target: string;
  content: string;
  components?: Components;
  className?: string;
}) {
  const notes = useNotesFor(target);
  return (
    <div data-note-target={target} className={className}>
      <MemoMarkdown content={content} notes={notes} components={components} />
    </div>
  );
}
