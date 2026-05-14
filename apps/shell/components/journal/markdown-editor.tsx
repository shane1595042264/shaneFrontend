"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function MarkdownEditor({ value, onChange }: Props) {
  // On mobile, single-column grid lets the textarea dominate (the preview
  // sits below for reference) so the writing surface stays usable on a phone.
  // On md+, the side-by-side layout returns and shares 60vh evenly.
  return (
    <div className="grid gap-2 md:h-[60vh] md:grid-cols-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write in markdown — GitHub-flavored. Headings (## ...), lists, links, code blocks all supported."
        className="min-h-[50vh] w-full resize-y rounded border border-white/10 bg-black/20 p-3 font-mono text-base text-white/90 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 md:h-full md:min-h-0 md:resize-none md:text-sm"
      />
      <div className="prose prose-invert max-h-[40vh] max-w-none overflow-y-auto rounded border border-white/10 bg-black/10 p-3 md:max-h-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "*Preview will appear here.*"}</ReactMarkdown>
      </div>
    </div>
  );
}
