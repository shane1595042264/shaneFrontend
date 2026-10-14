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
  // SHAN-576: the composer starts as one line. Open, it is a full markdown
  // editor with a toolbar, and it used to sit open above the collection on
  // every visit, pushing the cards below the fold of a page that is mostly
  // for reading them.
  const [open, setOpen] = useState(false);

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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-12 w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-left text-[15px] text-gray-400 transition-[background-color,border-color] hover:border-white/15 hover:bg-white/[0.04]"
      >
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-300 transition-colors group-hover:text-white"
        >
          +
        </span>
        <span className="min-w-0 flex-1 truncate">What did you learn?</span>
        <span className="hidden font-mono text-[11px] text-gray-400 sm:block">AI files it for you</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      onKeyDown={(e) => {
        // Esc folds an empty composer back to one line; with text in it, Esc
        // does nothing rather than throw a draft away.
        if (e.key === "Escape" && !text.trim() && !word.trim() && !definition.trim()) setOpen(false);
      }}
      className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
    >
      <div className="flex items-center gap-1">
        <ModeTab active={mode === "ai"} onClick={() => setMode("ai")}>
          AI note
        </ModeTab>
        <ModeTab active={mode === "manual"} onClick={() => setMode("manual")}>
          Quick add (no AI)
        </ModeTab>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto rounded-full px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          Close
        </button>
      </div>

      {mode === "ai" ? (
        <>
          <label className="block text-xs text-gray-400">
            What did you learn? (AI will classify it automatically)
          </label>
          <MarkdownEditor
            value={text}
            onChange={setText}
            placeholder='e.g. "gracias means thank you in Spanish" — or paste/drop an image to attach it'
            minHeight="6rem"
            autoFocus
            onImageUpload={uploadImage}
            onSubmit={submitAi}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">
              Ctrl+Enter to submit. Paste or drop images to embed them.
            </p>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              // contrast-exempt: the shade sits on disabled:bg-gray-700, not on the page
              // background, and WCAG 1.4.3 exempts inactive user interface components.
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors whitespace-nowrap"
            >
              {loading ? "Thinking..." : "Add Note"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="block text-xs text-gray-400">
            Add a card exactly as typed — no AI, so links and formatting are kept.
          </p>
          <input
            type="text"
            aria-label="Card title"
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
              aria-label="Category"
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
              aria-label="Language"
              placeholder="Language (optional)"
              className="w-36 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">
              Ctrl+Enter in the note to submit. Category defaults to “general”.
            </p>
            <button
              type="submit"
              disabled={loading || !word.trim()}
              // contrast-exempt: the shade sits on disabled:bg-gray-700, not on the page
              // background, and WCAG 1.4.3 exempts inactive user interface components.
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
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
        active
          ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/15"
          : "text-gray-400 hover:bg-white/[0.05] hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
