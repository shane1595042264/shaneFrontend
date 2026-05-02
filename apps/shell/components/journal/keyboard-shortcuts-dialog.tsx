"use client";

import { useEffect } from "react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string[]; description: string }> = [
  { keys: ["/"], description: "Focus search" },
  { keys: ["j"], description: "Next entry" },
  { keys: ["k"], description: "Previous entry" },
  { keys: ["Esc"], description: "Clear search / close dialog" },
  { keys: ["?"], description: "Toggle this help" },
];

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
    >
      <div
        className="bg-gray-950 border border-white/10 rounded-lg shadow-2xl w-full max-w-sm mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="shortcuts-dialog-title"
            className="text-sm font-semibold text-white tracking-tight"
          >
            Keyboard shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-sm leading-none"
            aria-label="Close shortcuts dialog"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li
              key={s.keys.join("+")}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-gray-400">{s.description}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded border border-white/15 bg-white/5 text-[11px] leading-none text-gray-300 font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
