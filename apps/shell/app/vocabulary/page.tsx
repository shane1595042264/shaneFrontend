"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchWords,
  fetchLabels,
  fetchLanguages,
  createWord,
  deleteWord,
  type VocabWord,
} from "@/lib/vocabulary-api";
import { FilterBar } from "@/components/vocabulary/filter-bar";
import { AddWordForm } from "@/components/vocabulary/add-word-form";
import { WordCard } from "@/components/vocabulary/word-card";
import { WordDetail } from "@/components/vocabulary/word-detail";

export default function VocabularyPage() {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadWords = useCallback(async () => {
    try {
      const data = await fetchWords({
        language: selectedLanguage || undefined,
        label: selectedLabel || undefined,
        search: search || undefined,
      });
      setWords(data);
    } catch {
      setInitError("Failed to load words. Backend may be down.");
    }
  }, [selectedLanguage, selectedLabel, search]);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  useEffect(() => {
    fetchLanguages().then(setLanguages).catch(() => {});
    fetchLabels().then(setLabels).catch(() => {});
  }, []);

  function refreshMeta() {
    fetchLanguages().then(setLanguages).catch(() => {});
    fetchLabels().then(setLabels).catch(() => {});
  }

  function showNotification(message: string, type: "error" | "success") {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }

  async function handleAddWord(data: {
    word: string;
    language: string;
    autoEnrich: boolean;
  }) {
    setAdding(true);
    try {
      await createWord(data);
      await loadWords();
      refreshMeta();
      showNotification(`Added "${data.word}"`, "success");
    } catch (err: any) {
      showNotification(err.message || "Failed to add word", "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteWord(id: string) {
    if (!confirm("Delete this word?")) return;
    setDeletingId(id);
    try {
      await deleteWord(id);
      await loadWords();
      refreshMeta();
      if (selectedWordId === id) setSelectedWordId(null);
    } catch (err: any) {
      showNotification(err.message || "Failed to delete word", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded text-sm transition-opacity ${
            notification.type === "error"
              ? "bg-red-500/10 border border-red-500/20 text-red-300"
              : "bg-green-500/10 border border-green-500/20 text-green-300"
          }`}
        >
          {notification.message}
          <button
            onClick={() => setNotification(null)}
            className="ml-3 text-xs opacity-60 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {initError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {initError}
        </div>
      )}

      <AddWordForm onSubmit={handleAddWord} loading={adding} />

      <FilterBar
        languages={languages}
        labels={labels}
        selectedLanguage={selectedLanguage}
        selectedLabel={selectedLabel}
        search={search}
        onLanguageChange={setSelectedLanguage}
        onLabelChange={setSelectedLabel}
        onSearchChange={setSearch}
      />

      <div className="text-xs text-gray-600">
        {words.length} word{words.length !== 1 ? "s" : ""}
      </div>

      {words.length === 0 && !initError ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg mb-2">No words yet</p>
          <p className="text-sm">
            Add your first vocabulary word above. AI will auto-generate
            definitions, pronunciation, and labels.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {words.map((word) => (
            <WordCard
              key={word.id}
              word={word}
              onClick={(w) => setSelectedWordId(w.id)}
              onDelete={handleDeleteWord}
              deleting={deletingId === word.id}
            />
          ))}
        </div>
      )}

      {selectedWordId && (
        <WordDetail
          wordId={selectedWordId}
          allWords={words}
          onClose={() => setSelectedWordId(null)}
          onWordUpdated={() => {
            loadWords();
            refreshMeta();
          }}
        />
      )}
    </div>
  );
}
