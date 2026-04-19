"use client";

import { useEffect, useState } from "react";

interface ShareActionsProps {
  date: string;
  formattedDate: string;
}

export function ShareActions({ date, formattedDate }: ShareActionsProps) {
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);
  const [url, setUrl] = useState(`https://shanejli.com/journal/${date}`);

  useEffect(() => {
    setUrl(`${window.location.origin}/journal/${date}`);
  }, [date]);

  const tweetText = `Journal entry — ${formattedDate}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(url)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
    setTimeout(() => setFeedback(null), 2000);
  }

  const srMessage =
    feedback === "copied"
      ? "Link copied to clipboard"
      : feedback === "error"
        ? "Failed to copy link"
        : "";

  return (
    <div className="flex flex-wrap items-center gap-2 mt-10 pt-4 border-t border-white/8">
      <span className="text-[10px] uppercase tracking-wider text-gray-600 mr-1">
        Share
      </span>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy link to this entry"
        className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span>Copy link</span>
      </button>

      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share this entry on X (formerly Twitter)"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span>Share to X</span>
      </a>

      {feedback === "copied" && (
        <span className="text-xs text-green-400" aria-hidden="true">
          Copied!
        </span>
      )}
      {feedback === "error" && (
        <span className="text-xs text-red-400" aria-hidden="true">
          Copy failed
        </span>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {srMessage}
      </div>
    </div>
  );
}
