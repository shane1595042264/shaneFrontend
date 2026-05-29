"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownEditor } from "@shane/ui";
import type { KnowledgeEntry, KnowledgeConnection } from "@/lib/knowledge-api";
import {
  fetchEntry,
  enrichEntryApi,
  deleteConnection,
  createConnection,
  updateEntry,
} from "@/lib/knowledge-api";
import { uploadImage } from "@/lib/api/images";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { KnowledgeCommentsThread } from "./comments-thread";

interface EntryDetailProps {
  entryId: string;
  allEntries: KnowledgeEntry[];
  currentUserId: string | null;
  onClose: () => void;
  onEntryUpdated: () => void;
}

const CONNECTION_TYPES = [
  "synonym",
  "antonym",
  "related",
  "translation",
  "root",
] as const;

export function EntryDetail({
  entryId,
  allEntries,
  currentUserId,
  onClose,
  onEntryUpdated,
}: EntryDetailProps) {
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [connections, setConnections] = useState<KnowledgeConnection[]>([]);
  const [connectedEntries, setConnectedEntries] = useState<KnowledgeEntry[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectTarget, setConnectTarget] = useState("");
  const [connectType, setConnectType] = useState<string>("related");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDefinition, setEditDefinition] = useState("");
  const [editExample, setEditExample] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useFocusTrap<HTMLDivElement>();

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function loadEntry() {
    setError(null);
    try {
      const data = await fetchEntry(entryId);
      setEntry(data.entry);
      setConnections(data.connections);
      setConnectedEntries(data.connectedEntries);
    } catch {
      setError("Failed to load entry details.");
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      await enrichEntryApi(entryId);
      await loadEntry();
      onEntryUpdated();
    } finally {
      setEnriching(false);
    }
  }

  function startEdit() {
    if (!entry) return;
    setEditDefinition(entry.definition ?? "");
    setEditExample(entry.exampleSentence ?? "");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function saveEdit() {
    if (!entry || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateEntry(entryId, {
        definition: editDefinition,
        exampleSentence: editExample,
      });
      setEntry(updated);
      setEditing(false);
      onEntryUpdated();
    } catch (err: any) {
      setError(err?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddConnection() {
    if (!connectTarget) return;
    try {
      await createConnection({
        fromWordId: entryId,
        toWordId: connectTarget,
        connectionType: connectType,
      });
      setShowConnectForm(false);
      setConnectTarget("");
      await loadEntry();
    } catch (err: any) {
      setError(err.message || "Failed to add connection.");
    }
  }

  async function handleDeleteConnection(connId: string) {
    try {
      await deleteConnection(connId);
      await loadEntry();
    } catch {
      setError("Failed to delete connection.");
    }
  }

  if (!entry) {
    return (
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Loading entry"
        aria-busy={!error}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        <div
          className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {error ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-red-400">{error}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={loadEntry}
                  className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white rounded transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-400 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div role="status" aria-label="Loading entry">
              <span className="sr-only">Loading entry…</span>
              <div className="mb-4">
                <div className="h-7 w-40 rounded bg-white/8 animate-pulse" />
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-4 w-16 rounded bg-white/8 animate-pulse" />
                  <div className="h-4 w-14 rounded bg-white/8 animate-pulse" />
                  <div className="h-3 w-12 rounded bg-white/8 animate-pulse" />
                </div>
              </div>
              <div className="mb-4 space-y-1.5">
                <div className="h-3 w-20 rounded bg-white/8 animate-pulse" />
                <div className="h-3 w-11/12 rounded bg-white/8 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-white/8 animate-pulse" />
              </div>
              <div className="mb-4 space-y-1.5">
                <div className="h-3 w-16 rounded bg-white/8 animate-pulse" />
                <div className="h-3 w-10/12 rounded bg-white/8 animate-pulse" />
              </div>
              <div className="mb-6 h-7 w-28 rounded bg-white/8 animate-pulse" />
              <div className="border-t border-white/8 pt-4 space-y-2">
                <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
                <div className="h-8 w-full rounded bg-white/8 animate-pulse" />
                <div className="h-8 w-full rounded bg-white/8 animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const otherEntries = allEntries.filter((e) => e.id !== entryId);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="entry-detail-title" className="text-2xl font-bold text-white">{entry.word}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-1.5 py-0.5 border border-white/10 rounded text-gray-400 capitalize">
                {entry.category}
              </span>
              <span className="text-xs px-1.5 py-0.5 border border-white/10 rounded text-gray-400">
                {entry.language}
              </span>
              {entry.partOfSpeech && (
                <span className="text-xs text-gray-500 italic">
                  {entry.partOfSpeech}
                </span>
              )}
              {entry.pronunciation && (
                <span className="text-sm text-gray-500">
                  {entry.pronunciation}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300">
            {error}
          </div>
        )}

        {editing ? (
          <div className="mb-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">
                Definition
              </label>
              <MarkdownEditor
                value={editDefinition}
                onChange={setEditDefinition}
                placeholder="Definition. Paste or drop an image to embed it."
                minHeight="6rem"
                onImageUpload={uploadImage}
                onSubmit={saveEdit}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase mb-1 block">
                Example
              </label>
              <MarkdownEditor
                value={editExample}
                onChange={setEditExample}
                placeholder="Example sentence (optional). Paste or drop an image to embed it."
                minHeight="6rem"
                onImageUpload={uploadImage}
                onSubmit={saveEdit}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {entry.definition && (
              <div className="mb-4">
                <h3 className="text-xs text-gray-500 uppercase mb-1">
                  Definition
                </h3>
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 text-gray-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {entry.definition}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {entry.exampleSentence && (
              <div className="mb-4">
                <h3 className="text-xs text-gray-500 uppercase mb-1">Example</h3>
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 italic text-gray-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {entry.exampleSentence}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {(entry.labels as string[])?.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs text-gray-500 uppercase mb-1">Labels</h3>
                <div className="flex flex-wrap gap-1">
                  {(entry.labels as string[]).map((label) => (
                    <span
                      key={label}
                      className="text-xs px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <EntrySource source={entry.source} />

            <div className="mb-6 flex flex-wrap items-center gap-2">
              {/* Mirrors backend ownership rule in PUT /api/knowledge/entries/:id
                  (SHAN-222): must be signed in AND either the creator or a
                  legacy entry whose createdBy is null. */}
              {currentUserId &&
                (entry.createdBy === null || entry.createdBy === currentUserId) && (
                  <button
                    onClick={startEdit}
                    className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-gray-300 rounded hover:bg-white/10 transition-colors"
                  >
                    Edit
                  </button>
                )}
              <button
                onClick={handleEnrich}
                disabled={enriching}
                className="px-3 py-1.5 text-xs bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded hover:bg-purple-600/30 disabled:opacity-50 transition-colors"
              >
                {enriching ? "Enriching..." : "Re-enrich with AI"}
              </button>
            </div>
          </>
        )}

        {/* Connections */}
        <div className="border-t border-white/8 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-gray-500 uppercase">Connections</h3>
            <button
              onClick={() => setShowConnectForm(!showConnectForm)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showConnectForm ? "Cancel" : "+ Connect"}
            </button>
          </div>

          {showConnectForm && (
            <div className="flex flex-wrap items-end gap-2 mb-3 p-3 bg-white/5 rounded">
              <select
                value={connectTarget}
                onChange={(e) => setConnectTarget(e.target.value)}
                className="flex-1 min-w-[120px] px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none"
              >
                <option value="">Select entry...</option>
                {otherEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.word} ({e.category}/{e.language})
                  </option>
                ))}
              </select>
              <select
                value={connectType}
                onChange={(e) => setConnectType(e.target.value)}
                className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none"
              >
                {CONNECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddConnection}
                disabled={!connectTarget}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded transition-colors"
              >
                Add
              </button>
            </div>
          )}

          {connections.length === 0 ? (
            <p className="text-xs text-gray-600">No connections yet.</p>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => {
                const isFrom = conn.fromWordId === entryId;
                const otherId = isFrom ? conn.toWordId : conn.fromWordId;
                const otherEntry = connectedEntries.find(
                  (e) => e.id === otherId
                );
                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-2 bg-white/5 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-gray-500">
                        {conn.connectionType}
                      </span>
                      <span className="text-gray-300">
                        {isFrom ? "\u2192" : "\u2190"}{" "}
                        {otherEntry?.word || "Unknown"}
                      </span>
                      <span className="text-xs text-gray-600">
                        ({otherEntry?.language})
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      aria-label="Delete connection"
                      className="text-xs text-gray-600 hover:text-red-400"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <KnowledgeCommentsThread
          entryId={entryId}
          entryAuthorId={entry.createdBy}
        />
      </div>
    </div>
  );
}

function EntrySource({ source }: { source: KnowledgeEntry["source"] }) {
  if (!source) return null;
  const { app, book, author, location, rawContext } = source;
  if (!app && !book && !author && !location && !rawContext) return null;

  return (
    <div className="mb-4">
      <h3 className="text-xs text-gray-500 uppercase mb-1">Source</h3>
      {(book || author) && (
        <p className="text-sm text-gray-300">
          {book && <span className="italic">{book}</span>}
          {book && author && <span className="text-gray-500"> &mdash; </span>}
          {author && <span>{author}</span>}
        </p>
      )}
      {location && (
        <p className="text-xs text-gray-500 mt-0.5">{location}</p>
      )}
      {app && (
        <span className="inline-block mt-1 text-xs px-1.5 py-0.5 border border-white/10 rounded text-gray-400">
          via {app}
        </span>
      )}
      {rawContext && (
        <blockquote className="mt-2 pl-3 border-l-2 border-white/10 text-xs text-gray-400 italic line-clamp-3">
          {rawContext}
        </blockquote>
      )}
    </div>
  );
}
