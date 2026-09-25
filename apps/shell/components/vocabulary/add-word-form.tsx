"use client";

import { useState } from "react";

interface AddWordFormProps {
  onSubmit: (data: { word: string; language: string; autoEnrich: boolean }) => void;
  loading: boolean;
}

const LANGUAGES = ["english", "chinese", "spanish", "french", "japanese", "korean", "german"];

export function AddWordForm({ onSubmit, loading }: AddWordFormProps) {
  const [word, setWord] = useState("");
  const [language, setLanguage] = useState("english");
  const [autoEnrich, setAutoEnrich] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim()) return;
    onSubmit({ word: word.trim(), language, autoEnrich });
    setWord("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs text-gray-400 mb-1">Word / Phrase</label>
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a word..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      <div>
        {/* SHAN-532: htmlFor/id rather than an aria-label, because the visible
            "Language" text is already the right name -- an aria-label would
            shadow it with a second string, and associating the real one also
            makes clicking the word focus the select. */}
        <label htmlFor="add-word-language" className="block text-xs text-gray-400 mb-1">Language</label>
        <select
          id="add-word-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-blue-500/50"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={autoEnrich}
          onChange={(e) => setAutoEnrich(e.target.checked)}
          className="rounded border-white/20"
        />
        AI enrich
      </label>

      <button
        type="submit"
        disabled={loading || !word.trim()}
        // contrast-exempt: the shade sits on disabled:bg-gray-700, not on the page
        // background, and WCAG 1.4.3 exempts inactive user interface components.
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors"
      >
        {loading ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
