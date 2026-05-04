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
import { toggleCommentReaction } from "@/lib/api/reactions";
import { ReactionBar } from "./reaction-bar";

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

  const onDelete = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await deleteComment(id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  // Render top-level comments + their direct replies (one level deep)
  const topLevel = comments.filter((c) => c.parentCommentId === null);
  const repliesFor = (parentId: string) =>
    comments.filter((c) => c.parentCommentId === parentId);

  const renderComment = (c: Comment, isReply: boolean) => {
    const canDelete = !!user && (user.id === c.authorId || user.id === entryAuthorId);
    return (
      <li key={c.id} className={`rounded border border-white/10 ${isReply ? "bg-black/20" : "bg-black/10"} p-3`}>
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            <span className="font-mono">{c.authorId.slice(0, 8)}</span>
            <span className="ml-2">{new Date(c.createdAt).toLocaleString()}</span>
            {c.editedAt && <span className="ml-2 italic">edited</span>}
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
                onClick={() => onDelete(c.id)}
                className="text-red-400 hover:text-red-300"
              >
                delete
              </button>
            )}
            {user && (
              <ReactionBar
                size="sm"
                onToggle={async (e) => {
                  await toggleCommentReaction(c.id, e);
                }}
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

  return (
    <section className="mt-10 border-t border-white/10 pt-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
        Comments {comments.length > 0 && <span className="ml-1 text-gray-400">({comments.length})</span>}
      </h2>

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
              Replying to <span className="font-mono">{replyTo.slice(0, 8)}</span>
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
            className="h-24 w-full resize-y rounded border border-white/10 bg-black/40 p-2 text-sm text-white/90 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !text.trim()}
            className="mt-2 rounded bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Sign in to comment.</p>
      )}
    </section>
  );
}
