"use client";

import { useState } from "react";

interface NoteInputProps {
  onSubmit: (text: string) => void;
  loading: boolean;
}

export function NoteInput({ onSubmit, loading }: NoteInputProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-xs text-gray-500">
        What did you learn? (AI will classify it automatically)
      </label>
      <div className="flex gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='e.g. "gracias means thank you in Spanish" or "void specifies a return type, not behavior"'
          rows={2}
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="self-end px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors whitespace-nowrap"
        >
          {loading ? "Thinking..." : "Add Note"}
        </button>
      </div>
      <p className="text-xs text-gray-600">
        Press Enter to submit. Shift+Enter for new line.
      </p>
    </form>
  );
}
