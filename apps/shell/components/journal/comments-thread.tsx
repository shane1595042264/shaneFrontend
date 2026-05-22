"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/lib/auth-context";
import {
  listComments,
  postComment,
  deleteComment,
  type Comment,
} from "@/lib/api/comments";
import { getCommentReactions, toggleCommentReaction } from "@/lib/api/reactions";
import { RelativeTime } from "@/lib/format-time";
import { ReactionDisplay } from "./reaction-display";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

interface Props {
  date: string;
  entryAuthorId: string;
}

export function CommentsThread({ date, entryAuthorId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listComments(date);
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
  }, [date]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await postComment(date, text.trim(), replyTo ?? undefined);
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
      await deleteComment(id);
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

  // Render top-level comments + their direct replies (one level deep)
  const topLevel = comments.filter((c) => c.parentCommentId === null);
  const repliesFor = (parentId: string) =>
    comments.filter((c) => c.parentCommentId === parentId);

  const renderComment = (c: Comment, isReply: boolean) => {
    const canDelete = !!user && (user.id === c.authorId || user.id === entryAuthorId);
    const displayName = c.author?.name?.trim() || "Anonymous";
    return (
      <li key={c.id} className={`rounded border border-white/10 ${isReply ? "bg-black/20" : "bg-black/10"} p-3`}>
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
            {!isReply && user && (
              <button
                type="button"
                onClick={() => setReplyTo(c.id)}
                className="hover:text-gray-300"
              >
                reply
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => requestDelete(c.id)}
                disabled={deletingId === c.id}
                className="text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === c.id ? "deleting…" : "delete"}
              </button>
            )}
            {user && (
              <ReactionDisplay
                size="sm"
                initial={c.reactions}
                refetch={() => getCommentReactions(c.id)}
                onToggle={(e) => toggleCommentReaction(c.id, e)}
              />
            )}
          </div>
        </div>
        <div className="prose prose-invert prose-sm max-w-none prose-p:my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.content}</ReactMarkdown>
        </div>
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
    <section className="mt-10 border-t border-white/10 pt-6" aria-busy={loading}>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
        Comments {comments.length > 0 && <span className="ml-1 text-gray-400">({comments.length})</span>}
      </h2>

      {loading ? (
        <div role="status" aria-label="Loading comments" className="space-y-3">
          <span className="sr-only">Loading comments…</span>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded border border-white/10 bg-black/10 p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/8 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-11/12 rounded bg-white/8 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-white/8 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
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
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Markdown supported. Be kind."
            className="h-24 w-full resize-y rounded border border-white/10 bg-black/40 p-2 text-base text-white/90 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 sm:text-sm"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !text.trim()}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Sign in to comment.</p>
      )}

      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={dismissDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="comment-delete-heading"
        >
          <FocusTrappedDiv
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="comment-delete-heading" className="text-lg font-semibold text-white mb-2">
              Delete comment by {deleteTargetName}?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This removes the comment and its reactions. This cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="mb-4 text-sm text-red-400">{deleteError}</p>
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
