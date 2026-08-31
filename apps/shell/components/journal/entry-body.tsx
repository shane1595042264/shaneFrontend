import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/lib/markdown-mermaid";

interface Props {
  content: string;
}

/**
 * Renders an entry's markdown body with GFM. Server Component (no "use client") —
 * renders during SSR/ISR so crawlers see the prose, no JS required. Mermaid
 * blocks upgrade to rendered diagrams client-side via markdownComponents
 * (SHAN-439); the SSR output keeps the plain code block as the fallback.
 */
export function EntryBody({ content }: Props) {
  return (
    <div className="prose prose-invert max-w-none prose-p:my-4 prose-headings:tracking-tight">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content || "*(empty)*"}
      </ReactMarkdown>
    </div>
  );
}
