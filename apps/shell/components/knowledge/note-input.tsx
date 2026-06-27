"use client";

import { useState } from "react";
import { MarkdownEditor } from "@shane/ui";
import { uploadImage } from "@/lib/api/images";

export interface QuickAddInput {
  word: string;
  definition: string;
  category: string;
  language: string;
}

interface NoteInputProps {
  onSubmit: (text: string) => void;
  onQuickAdd: (input: QuickAddInput) => void;
  loading: boolean;
  categories: string[];
}

type Mode = "ai" | "manual";

export function NoteInput({
  onSubmit,
  onQuickAdd,
  loading,
  categories,
}: NoteInputProps) {
  const [mode, setMode] = useState<Mode>("ai");

  // AI mode state
  const [text, setText] = useState("");

  // Quick-add (manual) mode state
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");

  function submitAi() {
    if (!text.trim() || loading) return;
    onSubmit(text.trim());
    setText("");
  }

  function submitManual() {
    if (!word.trim() || loading) return;
    onQuickAdd({
      word: word.trim(),
      definition: definition.trim(),
      // Default to "general" so a blank category never lands in "vocabulary"
      // (the only category the backend would AI-enrich — though autoEnrich:false
      // already blocks that, this keeps quick-adds out of the vocab bucket).
      category: category.trim() || "general",
      language: language.trim() || "n/a",
    });
    setWord("");
    setDefinition("");
    // Keep category + language: quick-adds tend to come in batches of the same kind.
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "ai") submitAi();
    else submitManual();
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-2">
      <div className="flex items-center gap-1">
        <ModeTab active={mode === "ai"} onClick={() => setMode("ai")}>
          AI note
        </ModeTab>
        <ModeTab active={mode === "manual"} onClick={() => setMode("manual")}>
          Quick add (no AI)
        </ModeTab>
      </div>

      {mode === "ai" ? (
        <>
          <label className="block text-xs text-gray-500">
            What did you learn? (AI will classify it automatically)
          </label>
          <MarkdownEditor
            value={text}
            onChange={setText}
            placeholder='e.g. "gracias means thank you in Spanish" — or paste/drop an image to attach it'
            minHeight="6rem"
            onImageUpload={uploadImage}
            onSubmit={submitAi}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-600">
              Ctrl+Enter to submit. Paste or drop images to embed them.
            </p>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors whitespace-nowrap"
            >
              {loading ? "Thinking..." : "Add Note"}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="block text-xs text-gray-500">
            Add a card exactly as typed — no AI, so links and formatting are kept.
          </label>
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Title — e.g. 5 step combo"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
          <MarkdownEditor
            value={definition}
            onChange={setDefinition}
            placeholder="Note — paste a link or anything; it is saved verbatim. Paste/drop images to embed."
            minHeight="5rem"
            onImageUpload={uploadImage}
            onSubmit={submitManual}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="quick-add-categories"
              placeholder="Category (pick or type, e.g. dance)"
              className="flex-1 min-w-[160px] px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
            <datalist id="quick-add-categories">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Language (optional)"
              className="w-36 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-600">
              Ctrl+Enter in the note to submit. Category defaults to “general”.
            </p>
            <button
              type="submit"
              disabled={loading || !word.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors whitespace-nowrap"
            >
              {loading ? "Adding..." : "Add Card"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${
        active
          ? "bg-white/15 border-white/30 text-white"
          : "bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
