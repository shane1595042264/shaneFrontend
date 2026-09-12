"use client";

import { useEffect, useState } from "react";
import { MarkdownEditor } from "@shane/ui";
import { EntryBody } from "@/components/journal/entry-body";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { RelativeTime } from "@/lib/format-time";
import { useAuth } from "@/lib/auth-context";
import { uploadImage } from "@/lib/api/images";
import { deleteAppend, editAppend, type JournalAppend } from "@/lib/api/journal";

interface Props {
  date: string;
  appends: JournalAppend[];
  /** Parent owns the entry payload, so edits and deletes are reported upward. */
  onEdited: (append: JournalAppend) => void;
  onDeleted: (id: string) => void;
}

/**
 * The sub-entry list under a journal entry, with author-only edit and delete
 * (SHAN-484, wired to the PATCH/DELETE routes from SHAN-483).
 *
 * Deletion on the backend is soft — the row survives for recovery and audit —
 * so removing it from this list optimistically after a confirm is the whole
 * user-facing story. Every mutation is also recorded in the entry's activity
 * trail, which is what makes a wrong agent edit traceable afterwards.
 */
export function EntryAppends({ date, appends, onEdited, onDeleted }: Props) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Escape closes the confirm dialog, mirroring comments-thread. Declared
  // before the early return so hook order stays stable across renders.
  useEffect(() => {
    if (!deleteConfirmId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deletingId) {
        setDeleteConfirmId(null);
        setDeleteError(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteConfirmId, deletingId]);

  if (appends.length === 0) return null;

  const startEdit = (a: JournalAppend) => {
    setEditError(null);
    setEditingId(a.id);
    setEditText(a.content);
  };

  const cancelEdit = () => {
    if (editSubmitting) return;
    setEditingId(null);
    setEditText("");
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim() || editSubmitting || editUploading) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await editAppend(date, editingId, editText.trim());
      onEdited(updated);
      setEditingId(null);
      setEditText("");
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message === "NOT_FOUND"
        ? "This sub-entry no longer exists."
        : "Failed to save edit";
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteAppend(date, id);
      setDeleteConfirmId(null);
      onDeleted(id);
    } catch {
      setDeleteError("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const dismissDelete = () => {
    if (deletingId) return;
    setDeleteConfirmId(null);
    setDeleteError(null);
  };

  return (
    <>
      <ol className="mt-8 space-y-4 border-l border-white/10 pl-4">
        {appends.map((a) => {
          // The backend accepts an edit or delete only from the append's own
          // author, so anyone else seeing the buttons would just get a 404.
          const mine = !!user && user.id === a.authorId;
          const isEditing = editingId === a.id;
          return (
            <li key={a.id} id={`append-${a.id}`} className="relative scroll-mt-6">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span
                  aria-hidden
                  className="absolute -left-[1.125rem] top-1.5 h-2 w-2 rounded-full bg-white/20"
                />
                <a
                  href={`#append-${a.id}`}
                  aria-label="Permalink to this sub-entry"
                  className="font-mono text-gray-400 transition-colors hover:text-gray-200 focus-visible:text-gray-200 focus-visible:outline-none"
                >
                  <RelativeTime iso={a.createdAt} />
                </a>
                {a.author?.name?.trim() ? (
                  <span className="text-gray-400">· {a.author.name}</span>
                ) : null}
                {a.editedAt && <span className="italic text-gray-400">edited</span>}
                {mine && !isEditing && (
                  <span className="ml-auto flex items-center gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="hover:text-gray-200"
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteConfirmId(a.id);
                      }}
                      disabled={deletingId === a.id}
                      className="text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === a.id ? "deleting…" : "delete"}
                    </button>
                  </span>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <MarkdownEditor
                    value={editText}
                    onChange={setEditText}
                    minHeight="8rem"
                    autoFocus
                    onImageUpload={uploadImage}
                    onUploadingChange={setEditUploading}
                    onSubmit={saveEdit}
                    placeholder="Edit this sub-entry in markdown. Ctrl+Enter to save."
                  />
                  {editError && (
                    <p role="alert" className="text-xs text-red-400">
                      {editError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={editSubmitting}
                      className="inline-flex min-h-8 items-center justify-center rounded bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={editSubmitting || editUploading || !editText.trim()}
                      className="inline-flex min-h-8 items-center justify-center rounded bg-white px-3 text-xs font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {editSubmitting ? "Saving…" : editUploading ? "Uploading…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <EntryBody content={a.content} />
              )}
            </li>
          );
        })}
      </ol>

      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={dismissDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-append-title"
        >
          <FocusTrappedDiv
            className="w-full max-w-sm rounded-lg border border-white/10 bg-gray-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-append-title" className="text-sm font-medium text-gray-100">
              Delete this sub-entry?
            </h2>
            <p className="mt-2 text-xs text-gray-400">
              It stops showing on the entry. The delete is recorded in the entry&apos;s
              activity trail.
            </p>
            {deleteError && (
              <p role="alert" className="mt-2 text-xs text-red-400">
                {deleteError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={dismissDelete}
                disabled={!!deletingId}
                className="inline-flex min-h-8 items-center justify-center rounded bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!!deletingId}
                className="inline-flex min-h-8 items-center justify-center rounded bg-red-500/90 px-3 text-xs font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </>
  );
}
