"use client";

import { useState } from "react";
import { EMOJI_SET, EMOJI_GLYPHS, type Emoji } from "@/lib/api/reactions";

interface Props {
  onToggle: (emoji: Emoji) => Promise<void> | void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function ReactionBar({ onToggle, disabled, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Emoji | null>(null);

  const handle = async (e: Emoji) => {
    setBusy(e);
    try {
      await onToggle(e);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const triggerClasses =
    size === "sm"
      ? "rounded border border-white/20 px-1.5 py-0.5 text-xs hover:bg-white/5"
      : "rounded border border-white/20 px-2 py-1 text-sm hover:bg-white/5";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className={`${triggerClasses} disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label="Add reaction"
      >
        😀 React
      </button>
      {open && (
        <div className="absolute z-20 mt-1 flex gap-1 rounded border border-white/10 bg-black/90 p-2 shadow-lg">
          {EMOJI_SET.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => handle(e)}
              disabled={busy !== null}
              className="rounded px-1 text-xl transition-transform hover:scale-125 disabled:opacity-50"
              aria-label={`React with ${e}`}
              title={e}
            >
              {EMOJI_GLYPHS[e]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
