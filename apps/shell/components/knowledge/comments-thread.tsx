"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownEditor } from "@shane/ui";
import { useAuth } from "@/lib/auth-context";
import {
  listKnowledgeComments,
  postKnowledgeComment,
  deleteKnowledgeComment,
  editKnowledgeComment,
  type KnowledgeComment,
} from "@/lib/api/knowledge-comments";
import { uploadImage } from "@/lib/api/images";
import { RelativeTime } from "@/lib/format-time";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

interface Props {
  entryId: string;
  entryAuthorId: string | null;
}

export function KnowledgeCommentsThread({ entryId, entryAuthorId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<KnowledgeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listKnowledgeComments(entryId);
      setComments(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await postKnowledgeComment(entryId, text.trim(), replyTo ?? undefined);
      setText("");
      setReplyTo(null);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (id: string) => {
    setDeleteError(null);
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteKnowledgeComment(id);
      setDeleteConfirmId(null);
      await refresh();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const dismissDelete = () => {
    if (deletingId) return;
    setDeleteConfirmId(null);
    setDeleteError(null);
  };

  const startEdit = (c: KnowledgeComment) => {
    setEditError(null);
    setEditingId(c.id);
    setEditText(c.content);
  };

  const cancelEdit = () => {
    if (editingSubmitting) return;
    setEditingId(null);
    setEditText("");
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim() || editingSubmitting) return;
    setEditingSubmitting(true);
    setEditError(null);
    try {
      await editKnowledgeComment(editingId, editText.trim());
      setEditingId(null);
      setEditText("");
      await refresh();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to save edit");
    } finally {
      setEditingSubmitting(false);
    }
  };

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

  const topLevel = comments.filter((c) => c.parentCommentId === null);
  const repliesFor = (parentId: string) =>
    comments.filter((c) => c.parentCommentId === parentId);

  const renderComment = (c: KnowledgeComment, isReply: boolean) => {
    const canDelete =
      !!user && (user.id === c.authorId || (entryAuthorId !== null && user.id === entryAuthorId));
    const canEdit = !!user && user.id === c.authorId;
    const isEditing = editingId === c.id;
    const displayName = c.author?.name?.trim() || "Anonymous";
    return (
      <li
        key={c.id}
        className={`rounded border border-white/10 ${
          isReply ? "bg-black/20" : "bg-black/10"
        } p-3`}
      >
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-2">
            {c.author?.avatarUrl ? (
              <img
                src={c.author.avatarUrl}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <span className="text-gray-300">{displayName}</span>
            <RelativeTime iso={c.createdAt} />
            {c.editedAt && <span className="italic">edited</span>}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {!isReply && user && !isEditing && (
              <button
                type="button"
                onClick={() => setReplyTo(c.id)}
                className="hover:text-gray-300"
              >
                reply
              </button>
            )}
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => startEdit(c)}
                className="hover:text-gray-300"
              >
                edit
              </button>
            )}
            {canDelete && !isEditing && (
              <button
                type="button"
                onClick={() => requestDelete(c.id)}
                disabled={deletingId === c.id}
                className="text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === c.id ? "deleting…" : "delete"}
              </button>
            )}
          </div>
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <MarkdownEditor
              value={editText}
              onChange={setEditText}
              minHeight="6rem"
              autoFocus
              onImageUpload={uploadImage}
              onSubmit={saveEdit}
              placeholder="Edit your comment in markdown. Ctrl+Enter to save."
            />
            {editError && (
              <p role="alert" className="text-xs text-red-400">{editError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={editingSubmitting}
                className="inline-flex min-h-8 items-center justify-center rounded bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editingSubmitting || !editText.trim()}
                className="inline-flex min-h-8 items-center justify-center rounded bg-white px-3 text-xs font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.content}</ReactMarkdown>
          </div>
        )}
        {!isReply && (
          <ul className="mt-2 space-y-2 pl-4 border-l border-white/10">
            {repliesFor(c.id).map((r) => renderComment(r, true))}
          </ul>
        )}
      </li>
    );
  };

  const deleteTarget = deleteConfirmId
    ? comments.find((c) => c.id === deleteConfirmId)
    : null;
  const deleteTargetName = deleteTarget?.author?.name?.trim() || "Anonymous";

  return (
    <section className="mt-6 border-t border-white/10 pt-4">
      <h3 className="mb-3 text-xs text-gray-500 uppercase">
        Comments
        {comments.length > 0 && (
          <span className="ml-1 text-gray-400">({comments.length})</span>
        )}
      </h3>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-gray-500">No comments yet.</p>
      ) : (
        <ul className="space-y-3">{topLevel.map((c) => renderComment(c, false))}</ul>
      )}

      {user ? (
        <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
          {replyTo && (
            <div className="mb-2 text-xs text-gray-500">
              Replying to{" "}
              <span className="text-gray-300">
                {comments.find((c) => c.id === replyTo)?.author?.name?.trim() || "Anonymous"}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-2 text-gray-400 hover:text-white"
              >
                cancel
              </button>
            </div>
          )}
          <MarkdownEditor
            value={text}
            onChange={setText}
            placeholder="Markdown supported. Paste or drop an image to embed it. Be kind."
            minHeight="6rem"
            onImageUpload={uploadImage}
            onSubmit={submit}
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="hidden text-[11px] text-gray-500 sm:inline">
              Ctrl+Enter to post
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !text.trim()}
              className="inline-flex min-h-9 w-full items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Sign in to comment.</p>
      )}

      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={dismissDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="knowledge-comment-delete-heading"
        >
          <FocusTrappedDiv
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="knowledge-comment-delete-heading"
              className="text-lg font-semibold text-white mb-2"
            >
              Delete comment by {deleteTargetName}?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This removes the comment. This cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="mb-4 text-sm text-red-400">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={dismissDelete}
                disabled={!!deletingId}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!!deletingId}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </section>
  );
}
