"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  fetchAllEntries,
  fetchLabels,
  fetchLanguages,
  fetchCategories,
  submitNote,
  deleteEntry,
  bulkDeleteEntries,
  type KnowledgeEntry,
} from "@/lib/knowledge-api";
import { useAuth } from "@/lib/auth-context";
import { NoteInput } from "@/components/knowledge/note-input";
import { CategoryTabs } from "@/components/knowledge/category-tabs";
import { EntryCard } from "@/components/knowledge/entry-card";
import { EntryDetail } from "@/components/knowledge/entry-detail";

export default function KnowledgePage() {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const lastClickedIndexRef = useRef<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadEntries = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const data = await fetchAllEntries({
        category: selectedCategory || undefined,
        search: debouncedSearch || undefined,
        signal: controller.signal,
      });
      setEntries(data);
      setInitError(null);
      hasLoaded.current = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setInitError("Failed to load entries. Backend may be down.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [selectedCategory, debouncedSearch]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    fetchLanguages().then(setLanguages).catch(() => {});
    fetchLabels().then(setLabels).catch(() => {});
  }, []);

  // Re-loading entries (filter change, deletions) invalidates the saved anchor
  // for shift-range selection: indices into the array shifted, so a "select
  // everything between last and new" would span the wrong rows.
  useEffect(() => {
    lastClickedIndexRef.current = null;
  }, [entries]);

  function refreshMeta() {
    fetchCategories().then(setCategories).catch(() => {});
    fetchLanguages().then(setLanguages).catch(() => {});
    fetchLabels().then(setLabels).catch(() => {});
  }

  function showNotification(message: string, type: "error" | "success") {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }

  // Current user can delete an entry if they created it, or if it's a legacy
  // entry (createdBy IS NULL — predates the column). Backend enforces this too;
  // the UI hint here just avoids dangling X buttons that would 403.
  const canDeleteEntry = useCallback(
    (entry: KnowledgeEntry) => {
      if (!currentUserId) return false;
      return entry.createdBy === null || entry.createdBy === currentUserId;
    },
    [currentUserId]
  );

  const deletableSelectedIds = useMemo(() => {
    const out: string[] = [];
    for (const e of entries) {
      if (selectedIds.has(e.id) && canDeleteEntry(e)) out.push(e.id);
    }
    return out;
  }, [entries, selectedIds, canDeleteEntry]);

  const selectableEntries = useMemo(
    () => entries.filter(canDeleteEntry),
    [entries, canDeleteEntry]
  );

  function exitEditMode() {
    setEditMode(false);
    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
  }

  function toggleSelectAt(index: number, shiftKey: boolean) {
    const entry = entries[index];
    if (!entry) return;
    if (!canDeleteEntry(entry)) {
      // Quiet no-op: row is visible but the user can't delete it, so selecting
      // it would be misleading. Don't move the anchor either.
      return;
    }

    const next = new Set(selectedIds);
    const anchor = lastClickedIndexRef.current;
    if (shiftKey && anchor !== null) {
      const [lo, hi] = anchor < index ? [anchor, index] : [index, anchor];
      // The clicked row decides whether the range becomes selected or deselected.
      const shouldSelect = !next.has(entry.id);
      for (let i = lo; i <= hi; i++) {
        const e = entries[i];
        if (!e || !canDeleteEntry(e)) continue;
        if (shouldSelect) next.add(e.id);
        else next.delete(e.id);
      }
    } else {
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
    }
    lastClickedIndexRef.current = index;
    setSelectedIds(next);
  }

  function selectAllVisible() {
    const next = new Set(selectedIds);
    for (const e of selectableEntries) next.add(e.id);
    setSelectedIds(next);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
  }

  async function handleSubmitNote(text: string) {
    setAdding(true);
    try {
      const { entry } = await submitNote(text);
      await loadEntries();
      refreshMeta();
      showNotification(
        `Added "${entry.word}" to ${entry.category}`,
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

  async function handleBulkDelete() {
    if (deletableSelectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const result = await bulkDeleteEntries(deletableSelectedIds);
      await loadEntries();
      refreshMeta();
      const parts = [`Deleted ${result.deleted.length}`];
      if (result.denied.length > 0) parts.push(`${result.denied.length} not yours`);
      if (result.notFound.length > 0) parts.push(`${result.notFound.length} missing`);
      showNotification(parts.join(", "), "success");
      setBulkConfirmOpen(false);
      exitEditMode();
    } catch (err: any) {
      showNotification(err.message || "Failed to delete entries", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  if (loading && !hasLoaded.current) {
    return <KnowledgeSkeleton />;
  }

  const selectedCount = selectedIds.size;
  const deletableSelectedCount = deletableSelectedIds.length;

  return (
    <div className="space-y-6 pb-24">
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
            aria-label="Dismiss notification"
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
        <div className="ml-auto">
          {editMode ? (
            <button
              onClick={exitEditMode}
              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 transition-colors"
            >
              Done
            </button>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              disabled={!currentUserId || entries.length === 0}
              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 rounded text-gray-300 transition-colors"
              title={currentUserId ? "Edit (select multiple)" : "Sign in to edit"}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-600">
        {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
        {editMode && (
          <span className="ml-3 text-gray-500">
            (click to select, shift-click for range)
          </span>
        )}
      </div>

      {entries.length === 0 && !initError ? (
        <EmptyState
          search={debouncedSearch}
          category={selectedCategory}
          onClearSearch={() => setSearch("")}
          onClearCategory={() => setSelectedCategory("")}
          onClearAll={() => {
            setSearch("");
            setSelectedCategory("");
          }}
        />
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {entries.map((entry, idx) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={idx}
              onClick={(e) => setSelectedEntryId(e.id)}
              onDelete={(id) => setDeleteConfirmId(id)}
              deleting={deletingId === entry.id}
              canDelete={canDeleteEntry(entry)}
              editMode={editMode}
              selected={selectedIds.has(entry.id)}
              onToggleSelect={toggleSelectAt}
            />
          ))}
        </div>
      )}

      {selectedEntryId && !editMode && (
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

      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur border-t border-white/10 px-4 py-3">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-gray-300">
              {selectedCount} selected
              {selectedCount > deletableSelectedCount && (
                <span className="ml-2 text-xs text-amber-400">
                  ({selectedCount - deletableSelectedCount} not yours)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllVisible}
                disabled={selectableEntries.length === 0}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded text-gray-300 transition-colors"
              >
                Select all
              </button>
              <button
                onClick={clearSelection}
                disabled={selectedCount === 0}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded text-gray-300 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setBulkConfirmOpen(true)}
                disabled={deletableSelectedCount === 0}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Delete {deletableSelectedCount > 0 ? deletableSelectedCount : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !bulkDeleting && setBulkConfirmOpen(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">
              Delete {deletableSelectedCount} entr
              {deletableSelectedCount === 1 ? "y" : "ies"}?
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              This permanently removes the selected entries and all their
              connections. This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkConfirmOpen(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {bulkDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  search: string;
  category: string;
  onClearSearch: () => void;
  onClearCategory: () => void;
  onClearAll: () => void;
}

function EmptyState({
  search,
  category,
  onClearSearch,
  onClearCategory,
  onClearAll,
}: EmptyStateProps) {
  const hasSearch = search.length > 0;
  const hasCategory = category.length > 0;

  if (!hasSearch && !hasCategory) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p className="text-lg mb-2">No knowledge entries yet</p>
        <p className="text-sm">
          Type anything you learned above. AI will classify it into the right
          category automatically.
        </p>
      </div>
    );
  }

  let heading: string;
  if (hasSearch && hasCategory) {
    heading = `No entries in ${category} match your search`;
  } else if (hasSearch) {
    heading = "No entries match your search";
  } else {
    heading = `No entries in ${category} yet`;
  }

  return (
    <div className="text-center py-16 text-gray-600">
      <p className="text-lg mb-4 capitalize">{heading}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {hasSearch && hasCategory && (
          <button
            onClick={onClearAll}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 transition-colors"
          >
            Clear all filters
          </button>
        )}
        {hasSearch && !hasCategory && (
          <button
            onClick={onClearSearch}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 transition-colors"
          >
            Clear search
          </button>
        )}
        {hasCategory && !hasSearch && (
          <button
            onClick={onClearCategory}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 transition-colors"
          >
            See all entries
          </button>
        )}
      </div>
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
