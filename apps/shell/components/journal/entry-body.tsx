import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { anchoredHeadings } from "@/components/markdown-anchored-headings";
import { markComponents, markPlugins } from "@/components/notes/marks";
import { markdownComponents } from "@/lib/markdown-mermaid";
import type { MarkdownHeading } from "@/lib/markdown-headings";
import type { MarkableNote } from "@/lib/rehype-note-marks";
import type { TermMarks } from "@/lib/rehype-term-marks";

interface Props {
  content: string;
  /**
   * Anchors the h1-h3 headings for the date page's table of contents (SHAN-571).
   * Must come from buildJournalToc() over this exact `content` string: the ids
   * are keyed on source lines. Left off, headings render without ids, which is
   * what the tea pages and editor previews want.
   */
  headings?: MarkdownHeading[];
  /**
   * Inline notes pinned to this body's text (SHAN-577). Each resolved one is
   * wrapped in a <mark> rendered by NoteMark; one whose words are gone simply
   * renders nothing here and is listed by OrphanNotes instead.
   */
  notes?: MarkableNote[];
  /** Words with a knowledge card, underlined after the notes (SHAN-712). */
  terms?: TermMarks;
}

/**
 * Renders an entry's markdown body with GFM. Server Component (no "use client") —
 * renders during SSR/ISR so crawlers see the prose, no JS required. Mermaid
 * blocks upgrade to rendered diagrams client-side via markdownComponents
 * (SHAN-439); the SSR output keeps the plain code block as the fallback.
 */
export function EntryBody({ content, headings, notes, terms }: Props) {
  const base = headings?.length
    ? { ...markdownComponents, ...anchoredHeadings(headings, { scrollMarginClass: "scroll-mt-under-header" }) }
    : markdownComponents;
  return (
    // break-words: a bare URL is one unbreakable word, and four of them in the
    // 2026-10-13 appends widened that page to 733px on a 390px phone, which
    // also dragged the fixed contents pill (sized off 100vw) off screen.
    <div className="prose prose-invert max-w-none break-words prose-p:my-4 prose-headings:tracking-tight">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={markPlugins(notes, terms)}
        components={markComponents(base, notes, terms)}
      >
        {content || "*(empty)*"}
      </ReactMarkdown>
    </div>
  );
}
