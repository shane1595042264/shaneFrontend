"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  EMOJI_GLYPHS,
  EMOJI_SET,
  type Emoji,
  type ReactionState,
} from "@/lib/api/reactions";

interface Props {
  /** Initial reaction state (from SSR or fetched). If absent, the component fetches on mount. */
  initial?: ReactionState;
  /** Re-fetches the latest summary + mine; called after every toggle. */
  refetch: () => Promise<ReactionState>;
  /** Toggles a single emoji on/off for the current user. */
  onToggle: (emoji: Emoji) => Promise<"added" | "removed">;
  size?: "sm" | "md";
}

export function ReactionDisplay({ initial, refetch, onToggle, size = "md" }: Props) {
  const { user } = useAuth();
  const [state, setState] = useState<ReactionState>(initial ?? { summary: [], mine: [] });
  const [loaded, setLoaded] = useState(!!initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Emoji | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loaded) return;
    refetch()
      .then(setState)
      .finally(() => setLoaded(true));
  }, [loaded, refetch]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const handle = async (emoji: Emoji) => {
    if (!user) return; // anon clicks do nothing
    setBusy(emoji);
    try {
      await onToggle(emoji);
      const fresh = await refetch();
      setState(fresh);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const chipClass = (mine: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
      size === "sm" ? "text-xs" : "text-sm"
    } transition-colors ${
      mine
        ? "border-blue-400/50 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25"
        : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
    } disabled:cursor-not-allowed disabled:opacity-50`;

  const triggerClass =
    size === "sm"
      ? "inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-xs text-gray-400 hover:bg-white/5"
      : "inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-sm text-gray-400 hover:bg-white/5";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {state.summary.map((row) => {
        const mine = state.mine.includes(row.emoji);
        return (
          <button
            key={row.emoji}
            type="button"
            onClick={() => handle(row.emoji)}
            disabled={busy !== null || !user}
            className={chipClass(mine)}
            aria-label={`${row.emoji} reaction, ${row.count} total${mine ? ", you reacted" : ""}`}
            title={mine ? `Click to remove your ${row.emoji}` : `Click to add ${row.emoji}`}
          >
            <span aria-hidden="true">{EMOJI_GLYPHS[row.emoji]}</span>
            <span className="font-mono">{row.count}</span>
          </button>
        );
      })}
      <div className="relative inline-block" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={!user}
          className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label="Add reaction"
          aria-haspopup="true"
          aria-expanded={open}
          title={user ? "Add reaction" : "Sign in to react"}
        >
          <span aria-hidden="true">😀</span>
          <span>{state.summary.length === 0 ? "React" : "+"}</span>
        </button>
        {open && (
          <div className="absolute z-20 mt-1 flex gap-1 rounded border border-white/10 bg-black/95 p-2 shadow-lg">
            {EMOJI_SET.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => handle(e)}
                disabled={busy !== null}
                className="rounded px-1 text-xl hover:bg-white/10 disabled:opacity-50"
                aria-label={`React with ${e}`}
                title={e}
              >
                {EMOJI_GLYPHS[e]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
