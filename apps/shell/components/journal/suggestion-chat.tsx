"use client";

import { useState } from "react";
import { submitSuggestion } from "@/lib/journal-api";
import type { SuggestionResponse } from "@shane/types";

interface SuggestionChatProps {
  date: string;
  onCorrected: (correctedContent: string) => void;
}

export function SuggestionChat({ date, onCorrected }: SuggestionChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SuggestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await submitSuggestion(date, input.trim());
      setResult(response);
    } catch {
      setError("Failed to process suggestion. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleAccept() {
    if (result) {
      onCorrected(result.correctedContent);
      setResult(null);
      setInput("");
      setIsOpen(false);
    }
  }

  function handleDiscard() {
    setResult(null);
    setInput("");
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-sm font-medium text-gray-300">
          Suggest a correction
        </span>
        <span className="text-gray-500 text-xs">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what should be corrected or added..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isLoading ? "Processing..." : "Submit"}
            </button>
          </form>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Corrected content
                </h3>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {result.correctedContent}
                </p>
              </div>

              {result.extractedFacts.length > 0 && (
                <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Extracted facts
                  </h3>
                  <ul className="space-y-1">
                    {result.extractedFacts.map((fact, i) => (
                      <li key={i} className="text-sm text-gray-300 flex gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAccept}
                  className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={handleDiscard}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
