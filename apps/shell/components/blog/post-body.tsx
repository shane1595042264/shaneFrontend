import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/lib/markdown-mermaid";

/**
 * Renders a post's markdown body with GFM. Server Component (no "use client"),
 * so the prose is in the ISR-cached HTML and readable with JS off.
 *
 * This is journal's EntryBody at a long-form reading size: wider measure,
 * larger type. Kept separate rather than parameterizing EntryBody so a tweak to
 * daily-note density never silently restyles published posts. Mermaid blocks
 * still upgrade client-side through the shared markdownComponents (SHAN-439).
 */
export function PostBody({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-lg max-w-none prose-p:my-5 prose-headings:tracking-tight prose-a:text-blue-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content || "*(empty)*"}
      </ReactMarkdown>
    </div>
  );
}
