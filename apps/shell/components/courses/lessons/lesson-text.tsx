"use client";

import { memo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { NoteMark, useNotesFor } from "@/components/notes/inline-notes";
import { rehypeNoteMarks, type MarkableNote } from "@/lib/rehype-note-marks";

/**
 * SHAN-652. Author-written prose in a lesson: bold, italics, inline code,
 * links and lists. Raw HTML is never rendered (react-markdown escapes it) and
 * images are dropped, so a course document cannot inject anything into the
 * page around it.
 */
const components: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-teal-300 underline decoration-teal-300/40 underline-offset-2 hover:decoration-teal-300"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.88em] text-gray-100">
      {children}
    </code>
  ),
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  // Block code belongs in a step's `code` field; inside prose it renders flat.
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-white/[0.04] p-3 font-mono text-sm last:mb-0">
      {children}
    </pre>
  ),
};

const withMarks: Components = { ...components, mark: NoteMark };
// A heading's text: one line of inline markdown, no paragraph around it.
const inlineComponents: Components = { ...components, p: ({ children }) => <>{children}</> };
const inlineWithMarks: Components = { ...inlineComponents, mark: NoteMark };

// Memoized: the notes provider re-renders on every hover, and a re-render here
// re-parses the markdown. Its notes array is stable until a note changes.
const Markdown = memo(function Markdown({
  text,
  notes,
  inline,
}: {
  text: string;
  notes: MarkableNote[];
  inline: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={notes.length ? [[rehypeNoteMarks, { notes }]] : []}
      components={inline ? (notes.length ? inlineWithMarks : inlineComponents) : notes.length ? withMarks : components}
      disallowedElements={["img"]}
      unwrapDisallowed
    >
      {text}
    </ReactMarkdown>
  );
});

/**
 * `noteTarget` (SHAN-653) makes the text selectable for Add note and Explain
 * and draws the reader's saved notes on it. It names this piece of text within
 * the course, so it has to stay the same between visits: the player builds it
 * from the lesson id, the step's index and which part of the step it is.
 */
export function LessonText({
  children,
  className,
  noteTarget,
  inline = false,
}: {
  children: string;
  className?: string;
  noteTarget?: string;
  /** For a heading: a span with no paragraph inside. */
  inline?: boolean;
}) {
  const notes = useNotesFor(noteTarget ?? "");
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={className} data-note-target={noteTarget}>
      <Markdown text={children} notes={noteTarget ? notes : NO_NOTES} inline={inline} />
    </Tag>
  );
}

const NO_NOTES: MarkableNote[] = [];

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the code is still selectable */
    }
  };
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-950">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-1.5">
        <span className="font-mono text-xs text-gray-400">{language ?? "code"}</span>
        <button
          type="button"
          onClick={copy}
          className="min-h-8 rounded px-2 text-xs text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-gray-200"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[22rem] overflow-auto p-4 font-mono text-[13px] leading-6 text-gray-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
