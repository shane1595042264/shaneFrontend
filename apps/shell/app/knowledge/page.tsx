"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchEntries,
  fetchLabels,
  fetchLanguages,
  fetchCategories,
  submitNote,
  deleteEntry,
  type KnowledgeEntry,
} from "@/lib/knowledge-api";
import { NoteInput } from "@/components/knowledge/note-input";
import { CategoryTabs } from "@/components/knowledge/category-tabs";
import { EntryCard } from "@/components/knowledge/entry-card";
import { EntryDetail } from "@/components/knowledge/entry-detail";

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const data = await fetchEntries({
        category: selectedCategory || undefined,
        search: search || undefined,
      });
      setEntries(data);
    } catch {
      setInitError("Failed to load entries. Backend may be down.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    fetchLanguages().then(setLanguages).catch(() => {});
    fetchLabels().then(setLabels).catch(() => {});
  }, []);

  function refreshMeta() {
    fetchCategories().then(setCategories).catch(() => {});
    fetchLanguages().then(setLanguages).catch(() => {});
    fetchLabels().then(setLabels).catch(() => {});
  }

  function showNotification(message: string, type: "error" | "success") {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleSubmitNote(text: string) {
    setAdding(true);
    try {
      const result = await submitNote(text);
      await loadEntries();
      refreshMeta();
      showNotification(
        `Added "${result.entry.word}" to ${result.category}`,
        "success"
      );
    } catch (err: any) {
      showNotification(err.message || "Failed to add note", "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    setDeletingId(id);
    try {
      await deleteEntry(id);
      await loadEntries();
      refreshMeta();
      if (selectedEntryId === id) setSelectedEntryId(null);
    } catch (err: any) {
      showNotification(err.message || "Failed to delete entry", "error");
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  }

  if (loading) {
    return <KnowledgeSkeleton />;
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

      <NoteInput onSubmit={handleSubmitNote} loading={adding} />

      <div className="flex flex-wrap items-center gap-4">
        <CategoryTabs
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 w-40"
        />
      </div>

      <div className="text-xs text-gray-600">
        {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
      </div>

      {entries.length === 0 && !initError ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg mb-2">No knowledge entries yet</p>
          <p className="text-sm">
            Type anything you learned above. AI will classify it into the right
            category automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onClick={(e) => setSelectedEntryId(e.id)}
              onDelete={(id) => setDeleteConfirmId(id)}
              deleting={deletingId === entry.id}
            />
          ))}
        </div>
      )}

      {selectedEntryId && (
        <EntryDetail
          entryId={selectedEntryId}
          allEntries={entries}
          onClose={() => setSelectedEntryId(null)}
          onEntryUpdated={() => {
            loadEntries();
            refreshMeta();
          }}
        />
      )}

      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">
              Delete entry?
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              This will permanently remove the entry and all its connections.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteEntry(deleteConfirmId)}
                disabled={!!deletingId}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded bg-white/8 animate-pulse h-24 w-full" />
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded bg-white/8 animate-pulse h-8 w-20"
            />
          ))}
        </div>
        <div className="rounded bg-white/8 animate-pulse h-8 w-40" />
      </div>
      <div className="rounded bg-white/8 animate-pulse h-4 w-16" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white/5 border border-white/8 rounded-lg space-y-3"
          >
            <div className="flex items-baseline gap-2">
              <div className="rounded bg-white/8 animate-pulse h-6 w-24" />
              <div className="rounded bg-white/8 animate-pulse h-3 w-12" />
            </div>
            <div className="flex gap-2">
              <div className="rounded bg-white/8 animate-pulse h-5 w-16" />
              <div className="rounded bg-white/8 animate-pulse h-5 w-14" />
            </div>
            <div className="rounded bg-white/8 animate-pulse h-4 w-full" />
            <div className="rounded bg-white/8 animate-pulse h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
