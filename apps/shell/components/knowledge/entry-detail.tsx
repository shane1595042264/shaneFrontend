"use client";

import { useEffect, useState } from "react";
import Link from "@/components/transition-link";
import { responsiveTableComponents } from "@/lib/markdown-table";
import { MarkdownEditor } from "@shane/ui";
import type { KnowledgeEntry, KnowledgeConnection } from "@/lib/knowledge-api";
import {
  KnowledgeEntryNotFoundError,
  fetchEntry,
  enrichEntryApi,
  deleteConnection,
  createConnection,
  updateEntry,
} from "@/lib/knowledge-api";
import { uploadImage } from "@/lib/api/images";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { KnowledgeCommentsThread } from "./comments-thread";
import { NotedMarkdown, ReaderNotesScope } from "@/components/notes/reader-notes-scope";
import { OrphanNotes } from "@/components/notes/inline-notes";
import { MemorizationLocations } from "./memorization-locations";
import { PracticeButton } from "@/components/practice/practice-button";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { humanizeActionError } from "@/lib/humanize-error";

interface EntryDetailProps {
  entryId: string;
  allEntries: KnowledgeEntry[];
  currentUserId: string | null;
  onClose: () => void;
  onEntryUpdated: () => void;
  /**
   * The entry id no longer resolves. The panel stays open on its not-found
   * message; the page uses this to drop ?entry= so a reload does not retry a
   * dead id (SHAN-501).
   */
  onNotFound?: () => void;
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
  onNotFound,
}: EntryDetailProps) {
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [connections, setConnections] = useState<KnowledgeConnection[]>([]);
  const [connectedEntries, setConnectedEntries] = useState<KnowledgeEntry[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectTarget, setConnectTarget] = useState("");
  const [connectType, setConnectType] = useState<string>("related");
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"copied" | "error" | null>(
    null
  );
  const [editing, setEditing] = useState(false);
  const [editWord, setEditWord] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [editExample, setEditExample] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useFocusTrap<HTMLDivElement>();
  useScrollLock();

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // A dialog opened from inside this one (Practice's setup modal) sits
      // later in the DOM; its Escape is for it alone, not for the card too.
      const open = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (open.length > 0 && open[open.length - 1] !== containerRef.current) return;
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function loadEntry() {
    setError(null);
    setNotFound(false);
    try {
      const data = await fetchEntry(entryId);
      setEntry(data.entry);
      setConnections(data.connections);
      setConnectedEntries(data.connectedEntries);
    } catch (err) {
      // A 404 is terminal - the row is gone, so there is nothing to retry and
      // the URL should stop pointing at it.
      if (err instanceof KnowledgeEntryNotFoundError) {
        setNotFound(true);
        onNotFound?.();
        return;
      }
      setError("Failed to load entry details.");
    }
  }

  async function copyLink() {
    // Deliberately filter-free: the shared link should open this entry, not
    // reproduce whatever the sender happened to have filtered to.
    const url = `${window.location.origin}/knowledge?entry=${entryId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("error");
    }
    setTimeout(() => setCopyFeedback(null), 2000);
  }

  // SHAN-637: the enrich response is the saved row (the same shape GET returns)
  // and enrich never touches connections, so there is no refetch whose failure
  // could read as a failed enrich.
  async function handleEnrich() {
    setEnriching(true);
    setError(null);
    try {
      setEntry(await enrichEntryApi(entryId));
      onEntryUpdated();
    } catch (err) {
      setError(humanizeActionError(err, "Failed to enrich entry."));
    } finally {
      setEnriching(false);
    }
  }

  function startEdit() {
    if (!entry) return;
    setEditWord(entry.word);
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
    const trimmedWord = editWord.trim();
    if (!trimmedWord) {
      setError("Title cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateEntry(entryId, {
        word: trimmedWord,
        // An emptied field goes out as null: the API ignores "" (SHAN-693).
        definition: editDefinition.trim() || null,
        exampleSentence: editExample.trim() || null,
      });
      setEntry(updated);
      setEditing(false);
      onEntryUpdated();
    } catch (err: any) {
      setError(humanizeActionError(err, "Failed to save changes."));
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
      setError(humanizeActionError(err, "Failed to add connection."));
    }
  }

  async function handleDeleteConnection(connId: string) {
    try {
      await deleteConnection(connId);
      await loadEntry();
    } catch (err: any) {
      setError(humanizeActionError(err, "Failed to delete connection."));
    }
  }

  const canEdit =
    !!currentUserId && (entry?.createdBy === null || entry?.createdBy === currentUserId);

  if (!entry) {
    return (
      <Shell
        containerRef={containerRef}
        onClose={onClose}
        label={notFound ? "Entry not found" : "Loading entry"}
        busy={!error && !notFound}
      >
        <div className="px-6 py-8 md:px-8">
          {notFound ? (
            <div className="space-y-4 text-center">
              <p className="text-[15px] text-gray-200">This entry no longer exists.</p>
              <p className="text-sm text-gray-400">
                It was probably deleted after the link was shared.
              </p>
              <button onClick={onClose} className={quietButton}>
                Back to entries
              </button>
            </div>
          ) : error ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-300">{error}</p>
              <div className="flex justify-center gap-2">
                <button onClick={loadEntry} className={primaryButton}>
                  Retry
                </button>
                <button onClick={onClose} className={quietButton}>
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div role="status" aria-label="Loading entry">
              <span className="sr-only">Loading entry…</span>
              <div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
              <div className="mt-3 h-9 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
              <div className="mt-5 flex gap-2">
                <div className="h-10 w-28 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="h-10 w-16 animate-pulse rounded-full bg-white/[0.06]" />
              </div>
              <div className="mt-8 space-y-2.5">
                <div className="h-4 w-11/12 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 w-10/12 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.06]" />
              </div>
              <div className="mt-8 h-16 w-full animate-pulse rounded-xl bg-white/[0.04]" />
            </div>
          )}
        </div>
      </Shell>
    );
  }

  const otherEntries = allEntries.filter((e) => e.id !== entryId);
  const labels = (entry.labels as string[] | null) ?? [];
  const hasSource = sourceHasContent(entry.source);
  const canRecite = canEdit && !!entry.definition?.trim();

  return (
    <Shell containerRef={containerRef} onClose={onClose} labelledBy="entry-detail-title">
      {/* The header stays put while the body scrolls, so Practice and Close
          are always one click away however long the card is. */}
      <header className="shrink-0 border-b border-white/[0.06] px-6 pb-5 pt-6 md:px-8 md:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
              <span className="capitalize text-gray-300">{entry.category}</span>
              <span>{entry.language}</span>
              {entry.partOfSpeech && <span className="italic">{entry.partOfSpeech}</span>}
            </p>
            <h2
              id="entry-detail-title"
              className="mt-2 text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-white [overflow-wrap:anywhere] md:text-4xl"
            >
              {entry.word}
            </h2>
            {entry.pronunciation && (
              <p className="mt-1.5 font-mono text-sm text-gray-400">{entry.pronunciation}</p>
            )}
          </div>
          <div className="-mr-2 flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy link to this entry"
              title="Copy link to this entry"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {copyFeedback === "copied" ? "Copied" : copyFeedback === "error" ? "Failed" : "Link"}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              &times;
            </button>
          </div>
          <span aria-live="polite" className="sr-only">
            {copyFeedback === "copied"
              ? "Link copied to clipboard"
              : copyFeedback === "error"
                ? "Failed to copy link"
                : ""}
          </span>
        </div>

        {!editing && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {/* The same button as on the card in the grid: a practice-mode
                session for this one card, set up on first use. It decides
                auth on click, so it shows for everyone, as it does there. */}
            <PracticeButton itemId={entry.id} itemName={entry.word} className={primaryButton} />
            {/* Mirrors backend ownership rule in PUT /api/knowledge/entries/:id
                (SHAN-222), which POST .../enrich shares since SHAN-570 and
                recite since SHAN-575: must be signed in AND either the creator
                or a legacy entry whose createdBy is null. Anyone else would
                only ever get a 401/403. */}
            {canEdit && (
              <>
                {canRecite && (
                  <Link
                    href={`/knowledge/recite?entry=${encodeURIComponent(entry.id)}`}
                    className={quietButton}
                  >
                    Recite
                  </Link>
                )}
                <button onClick={startEdit} className={quietButton}>
                  Edit
                </button>
                <button onClick={handleEnrich} disabled={enriching} className={quietButton}>
                  {enriching ? "Enriching…" : "Re-enrich with AI"}
                </button>
              </>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 pt-6 md:px-8">
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-inset ring-red-500/20"
          >
            {error}
          </div>
        )}

        {editing ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="knowledge-edit-title" className="block text-sm text-gray-400">
                Title
              </label>
              <input
                id="knowledge-edit-title"
                type="text"
                value={editWord}
                onChange={(e) => setEditWord(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-[15px] text-white transition-colors focus:border-white/25 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Definition</label>
              <MarkdownEditor
                value={editDefinition}
                onChange={setEditDefinition}
                placeholder="Definition. Paste or drop an image to embed it."
                minHeight="6rem"
                onImageUpload={uploadImage}
                onSubmit={saveEdit}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Example</label>
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
              <button onClick={cancelEdit} disabled={saving} className={quietButton}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving} className={primaryButton}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* SHAN-596: select words in the definition or the example to
                note them or have them explained, privately. */}
            <ReaderNotesScope surface="knowledge" resourceId={entry.id} title={entry.word}>
              <div className="space-y-6">
                {entry.definition && (
                  <NotedMarkdown
                    target="definition"
                    content={entry.definition}
                    components={responsiveTableComponents}
                    className="prose prose-invert max-w-none text-[16px] leading-7 text-gray-200 prose-p:my-2 first:prose-p:mt-0"
                  />
                )}

                {entry.exampleSentence && (
                  <figure className="rounded-xl bg-white/[0.025] px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
                    <figcaption className="text-xs text-gray-400">Example</figcaption>
                    <NotedMarkdown
                      target="example"
                      content={entry.exampleSentence}
                      components={responsiveTableComponents}
                      className={`prose prose-invert prose-sm mt-1 max-w-none text-gray-200 prose-p:my-1 ${
                        looksLikeCode(entry.exampleSentence) ? "font-mono" : "italic"
                      }`}
                    />
                  </figure>
                )}
              </div>
              <OrphanNotes />
            </ReaderNotesScope>

            {(labels.length > 0 || hasSource) && (
              <dl className="grid gap-x-6 gap-y-5 border-t border-white/[0.06] pt-6 text-sm sm:grid-cols-[5.5rem_1fr]">
                {labels.length > 0 && (
                  <>
                    <dt className="text-gray-400 sm:pt-1">Labels</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {labels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex h-7 items-center rounded-full bg-white/[0.04] px-2.5 text-xs text-gray-300 ring-1 ring-inset ring-white/[0.08]"
                        >
                          #{label}
                        </span>
                      ))}
                    </dd>
                  </>
                )}
                {hasSource && (
                  <>
                    <dt className="text-gray-400">Source</dt>
                    <dd>
                      <EntrySource source={entry.source} />
                    </dd>
                  </>
                )}
              </dl>
            )}

            <div className="border-t border-white/[0.06] pt-6">
              <MemorizationLocations
                entry={entry}
                canEdit={canEdit}
                onUpdated={(updated) => {
                  setEntry(updated);
                  onEntryUpdated();
                }}
              />
            </div>
          </div>
        )}

        {/* Connections */}
        <section className="mt-8 border-t border-white/[0.06] pt-6" aria-labelledby="connections-heading">
          <div className="mb-3 flex items-center justify-between">
            <h3 id="connections-heading" className="text-sm font-medium text-white">
              Connections
              {connections.length > 0 && (
                <span className="ml-2 font-mono text-xs tabular-nums text-gray-400">
                  {connections.length}
                </span>
              )}
            </h3>
            <button
              onClick={() => setShowConnectForm(!showConnectForm)}
              className="inline-flex h-8 items-center rounded-full px-3 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {showConnectForm ? "Cancel" : "+ Connect"}
            </button>
          </div>

          {showConnectForm && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.025] p-3 ring-1 ring-inset ring-white/[0.06]">
              {/* SHAN-532: toggle-hidden, so Lighthouse scored /knowledge clean
                  while these two were as anonymous as the /vocabulary filters. */}
              <select
                aria-label="Entry to connect"
                value={connectTarget}
                onChange={(e) => setConnectTarget(e.target.value)}
                className="h-9 min-w-[140px] flex-1 rounded-lg border border-white/10 bg-gray-950 px-2.5 text-sm text-white focus:border-white/25 focus:outline-none"
              >
                <option value="">Select entry...</option>
                {otherEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.word} ({e.category}/{e.language})
                  </option>
                ))}
              </select>
              <select
                aria-label="Connection type"
                value={connectType}
                onChange={(e) => setConnectType(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-gray-950 px-2.5 text-sm text-white focus:border-white/25 focus:outline-none"
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
                className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-medium text-black transition-[background-color,transform] hover:bg-gray-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-400"
              >
                Add
              </button>
            </div>
          )}

          {connections.length === 0 ? (
            <p className="text-sm text-gray-400">No connections yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {connections.map((conn) => {
                const isFrom = conn.fromWordId === entryId;
                const otherId = isFrom ? conn.toWordId : conn.fromWordId;
                const otherEntry = connectedEntries.find((e) => e.id === otherId);
                return (
                  <li
                    key={conn.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.025] py-2 pl-3 pr-1.5 text-sm ring-1 ring-inset ring-white/[0.06]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="shrink-0 font-mono text-xs text-gray-400">
                        {conn.connectionType}
                      </span>
                      <span className="truncate text-gray-200">
                        <span aria-hidden="true" className="text-gray-400">
                          {isFrom ? "→" : "←"}
                        </span>{" "}
                        {otherEntry?.word || "Unknown"}
                      </span>
                      {otherEntry?.language && (
                        <span className="shrink-0 text-xs text-gray-400">{otherEntry.language}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      aria-label="Delete connection"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
                    >
                      &times;
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <KnowledgeCommentsThread entryId={entryId} entryAuthorId={entry.createdBy} />
      </div>
    </Shell>
  );
}

const buttonBase =
  "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm transition-[background-color,color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = `${buttonBase} bg-white px-5 font-medium text-black hover:bg-gray-200`;
const quietButton = `${buttonBase} text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/[0.06] hover:text-white`;

/** Brackets, semicolons, pipes or arrows: an example that is code reads better in mono. */
function looksLikeCode(text: string): boolean {
  return /[{}();|]|=>|::|\$ /.test(text);
}

/** Overlay plus panel. The panel is a column: fixed header, scrolling body. */
function Shell({
  containerRef,
  onClose,
  label,
  labelledBy,
  busy,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  label?: string;
  labelledBy?: string;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-busy={busy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,56rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gray-950 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function sourceHasContent(source: KnowledgeEntry["source"]): boolean {
  if (!source) return false;
  const { app, book, author, location, rawContext } = source;
  return !!(app || book || author || location || rawContext);
}

function EntrySource({ source }: { source: KnowledgeEntry["source"] }) {
  if (!source || !sourceHasContent(source)) return null;
  const { app, book, author, location, rawContext } = source;

  return (
    <div className="space-y-2">
      {(book || author || app) && (
        <p className="text-gray-200">
          {book && <span className="italic">{book}</span>}
          {book && author && <span className="text-gray-400"> by </span>}
          {author && <span>{author}</span>}
          {app && (
            <span className={book || author ? "ml-2 text-gray-400" : "text-gray-400"}>
              via {app}
            </span>
          )}
        </p>
      )}
      {location && <p className="text-xs text-gray-400">{location}</p>}
      {rawContext && (
        <blockquote className="line-clamp-4 border-l-2 border-white/10 pl-3 text-[13px] leading-relaxed text-gray-400">
          {rawContext}
        </blockquote>
      )}
    </div>
  );
}
