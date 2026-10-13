import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/lib/markdown-mermaid";
import { anchoredHeadings } from "@/components/markdown-anchored-headings";
import type { MarkdownHeading } from "@/lib/markdown-headings";

/**
 * Renders a post's markdown body with GFM. Server Component (no "use client"),
 * so the prose is in the ISR-cached HTML and readable with JS off.
 *
 * This is journal's EntryBody at a long-form reading size: wider measure,
 * larger type. Kept separate rather than parameterizing EntryBody so a tweak to
 * daily-note density never silently restyles published posts. Mermaid blocks
 * still upgrade client-side through the shared markdownComponents (SHAN-439).
 *
 * Takes the body verbatim. Callers strip the echoed title first with
 * stripLeadingTitleHeading (SHAN-540) because they need the stripped text for
 * the reading time and the descriptions anyway, and doing it twice would be
 * the same work for the same answer. `headings` must come from
 * extractBodyHeadings() over that same stripped string, or the line numbers the
 * ids are keyed on will be off by however many lines were removed.
 */
export function PostBody({
  content,
  headings,
}: {
  content: string;
  headings?: MarkdownHeading[];
}) {
  const components = headings?.length
    ? { ...markdownComponents, ...anchoredHeadings(headings) }
    : markdownComponents;
  return (
    <div className="prose prose-invert prose-lg max-w-none prose-p:my-5 prose-headings:tracking-tight prose-a:text-blue-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content || "*(empty)*"}
      </ReactMarkdown>
    </div>
  );
}
