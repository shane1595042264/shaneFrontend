import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

/**
 * Renders an entry's markdown body with GFM. Server Component (no "use client") —
 * renders during SSR/ISR so crawlers see the prose, no JS required.
 */
export function EntryBody({ content }: Props) {
  return (
    <div className="prose prose-invert max-w-none prose-p:my-4 prose-headings:tracking-tight">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "*(empty)*"}</ReactMarkdown>
    </div>
  );
}
