"use client";

import { useEffect, useState } from "react";
import type { KnowledgeEntry, KnowledgeConnection } from "@/lib/knowledge-api";
import {
  fetchEntry,
  enrichEntryApi,
  deleteConnection,
  createConnection,
} from "@/lib/knowledge-api";

interface EntryDetailProps {
  entryId: string;
  allEntries: KnowledgeEntry[];
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        <div
          className="bg-gray-900 border border-white/10 rounded-lg p-8"
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
            <div className="animate-pulse text-gray-500">Loading...</div>
          )}
        </div>
      </div>
    );
  }

  const otherEntries = allEntries.filter((e) => e.id !== entryId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{entry.word}</h2>
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

        {entry.definition && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-500 uppercase mb-1">
              Definition
            </h3>
            <p className="text-sm text-gray-300">{entry.definition}</p>
          </div>
        )}

        {entry.exampleSentence && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-500 uppercase mb-1">Example</h3>
            <p className="text-sm text-gray-300 italic">
              {entry.exampleSentence}
            </p>
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

        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="mb-6 px-3 py-1.5 text-xs bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded hover:bg-purple-600/30 disabled:opacity-50 transition-colors"
        >
          {enriching ? "Enriching..." : "Re-enrich with AI"}
        </button>

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
      </div>
    </div>
  );
}
