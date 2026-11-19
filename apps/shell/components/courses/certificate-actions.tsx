"use client";

import { useState } from "react";

/** SHAN-720. Print (or Save as PDF) and copy the verification link. */
export function CertificateActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
      >
        Print or save as PDF
      </button>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-10 items-center rounded-lg px-4 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
