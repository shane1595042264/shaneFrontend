"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function MarkdownEditor({ value, onChange }: Props) {
  return (
    <div className="grid h-[60vh] gap-2 md:grid-cols-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write in markdown — GitHub-flavored. Headings (## ...), lists, links, code blocks all supported."
        className="h-full w-full resize-none rounded border border-white/10 bg-black/20 p-3 font-mono text-sm text-white/90 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
      />
      <div className="prose prose-invert max-w-none overflow-y-auto rounded border border-white/10 bg-black/10 p-3">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "*Preview will appear here.*"}</ReactMarkdown>
      </div>
    </div>
  );
}
