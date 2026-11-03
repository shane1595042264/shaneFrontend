"use client";

import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

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

export function LessonText({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        disallowedElements={["img"]}
        unwrapDisallowed
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

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
