"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownEditor } from "@shane/ui";
import { responsiveTableComponents } from "@/lib/markdown-table";
import { useAuth } from "@/lib/auth-context";
import { LoginButton } from "@/components/login-button";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { RelativeTime } from "@/lib/format-time";
import { resolveViewerTimezone, timezoneTagFor } from "@/lib/timezone";
import { uploadImage } from "@/lib/api/images";
import {
  deleteBlogComment,
  editBlogComment,
  listBlogComments,
  postBlogComment,
  type BlogComment,
} from "@/lib/api/blog-social";

interface Props {
  slug: string;
  /** The post's author, who may delete anyone's comment (moderation). */
  postAuthorId: string;
}

/**
 * SHAN-488. The comment thread under a public post.
 *
 * A client island inside the ISR Server Component, same shape as PostActions:
 * the cached HTML stays byte-identical for every visitor and nothing about who
 * is reading leaks into the CDN. The cost is that the thread arrives after
 * hydration, hence the skeleton.
 *
 * Flat, not threaded. Everything renders through ReactMarkdown with remarkGfm
 * and no rehype-raw, so raw HTML in a comment body stays inert — which matters
 * more here than in the journal, because this page is world-writable.
 *
 * Gated on useAuth().user rather than on a token existing in localStorage: a
 * revoked token still sits there and /api/auth/me answers 200 with
 * {user: null}, so a presence check would render a composer whose every write
 * 401s (SHAN-463).
 */
export function BlogComments({ slug, postAuthorId }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setComments(await listBlogComments(slug));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async () => {
    const body = text.trim();
    if (!body || submitting || uploading) return;
    setSubmitting(true);
    setPostError(null);
    try {
      await postBlogComment(slug, body);
      setText("");
      await refresh();
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async () => {
    const body = editText.trim();
    if (!editingId || !body || editSaving || editUploading) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await editBlogComment(editingId, body, slug);
      setEditingId(null);
      setEditText("");
      await refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save edit");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBlogComment(deleteId, slug);
      setDeleteId(null);
      await refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!deleteId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) {
        setDeleteId(null);
        setDeleteError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteId, deleting]);

  const viewerTz = resolveViewerTimezone(user);
  const deleteTarget = deleteId ? comments.find((c) => c.id === deleteId) : null;

  const renderComment = (c: BlogComment) => {
    const isEditing = editingId === c.id;
    const canEdit = !!user && user.id === c.authorId;
    const canDelete = !!user && (user.id === c.authorId || user.id === postAuthorId);
    const displayName = c.author?.name?.trim() || "Anonymous";
    const tzTag = timezoneTagFor(c.authorTimezone, viewerTz);

    return (
      <li key={c.id} className="rounded border border-white/10 bg-black/10 p-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-2">
            {c.author?.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.author.avatarUrl}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="text-gray-300">{displayName}</span>
            {c.authorId === postAuthorId && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-gray-300">
                author
              </span>
            )}
            <RelativeTime iso={c.createdAt} />
            {tzTag && (
              <span
                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
                title={`Posted in ${tzTag}; you're viewing in ${viewerTz}`}
              >
                {tzTag}
              </span>
            )}
            {c.editedAt && <span className="italic">edited</span>}
          </span>
          {!isEditing && (canEdit || canDelete) && (
            <span className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditError(null);
                    setEditingId(c.id);
                    setEditText(c.content);
                  }}
                  className="hover:text-gray-300"
                >
                  edit
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteId(c.id);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  delete
                </button>
              )}
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <MarkdownEditor
              value={editText}
              onChange={setEditText}
              minHeight="6rem"
              autoFocus
              onImageUpload={uploadImage}
              onUploadingChange={setEditUploading}
              onSubmit={saveEdit}
              placeholder="Edit your comment in markdown. Ctrl+Enter to save."
            />
            {editError && (
              <p role="alert" className="text-xs text-red-400">
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (editSaving) return;
                  setEditingId(null);
                  setEditText("");
                  setEditError(null);
                }}
                disabled={editSaving}
                className="inline-flex min-h-8 items-center rounded bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={editSaving || editUploading || !editText.trim()}
                className="inline-flex min-h-8 items-center rounded bg-white px-3 text-xs font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editSaving ? "Saving…" : editUploading ? "Uploading…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={responsiveTableComponents}>
              {c.content}
            </ReactMarkdown>
          </div>
        )}
      </li>
    );
  };

  return (
    <section
      id="comments"
      className="mt-12 border-t border-white/10 pt-6"
      aria-busy={loading}
    >
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
        Comments{comments.length > 0 && <span className="ml-1">({comments.length})</span>}
      </h2>

      {loading ? (
        <div role="status" aria-label="Loading comments" className="space-y-3">
          <span className="sr-only">Loading comments…</span>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded border border-white/10 bg-black/10 p-3">
              <div className="mb-2 h-3 w-32 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/8" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-3">{comments.map(renderComment)}</ul>
      )}

      {authLoading ? (
        // Nothing auth-dependent may reach the server-rendered HTML. This page
        // is ISR, so the composer block IS server-rendered, and the signed-out
        // branch below mounts <LoginButton>, whose GoogleLogin child is a bare
        // <div> that the Google Identity script fills with an iframe. GSI wins
        // that race often enough that React finds unexpected children where it
        // expected an empty div and throws hydration error #418, discarding and
        // re-rendering the tree.
        //
        // `loading` is true during SSR and on the first client render alike
        // (auth-context resolves /api/auth/me in an effect), so gating on it
        // makes both passes emit this identical placeholder and defers every
        // third-party node to after hydration. Every other LoginButton on the
        // site sits behind a client-only auth gate, which is why this is the
        // first place the problem could appear.
        <div className="mt-4 h-24 rounded border border-white/10 bg-black/20" aria-hidden="true" />
      ) : user ? (
        <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
          <MarkdownEditor
            value={text}
            onChange={setText}
            placeholder="Markdown supported. Paste a screenshot to upload. Be kind."
            minHeight="6rem"
            onSubmit={submit}
            onImageUpload={uploadImage}
            onUploadingChange={setUploading}
          />
          {postError && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {postError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || uploading || !text.trim()}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Posting…" : uploading ? "Uploading…" : "Post comment"}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded border border-white/10 bg-black/20 p-4">
          <p className="mb-3 text-sm text-gray-400">
            Sign in to join the conversation. Reading needs no account.
          </p>
          <LoginButton />
        </div>
      )}

      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => {
            if (!deleting) {
              setDeleteId(null);
              setDeleteError(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="blog-comment-delete-heading"
        >
          <FocusTrappedDiv
            className="mx-4 w-full max-w-sm rounded-lg border border-white/10 bg-gray-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="blog-comment-delete-heading"
              className="mb-2 text-lg font-semibold text-white"
            >
              Delete comment by {deleteTarget?.author?.name?.trim() || "Anonymous"}?
            </h3>
            <p className="mb-4 text-sm text-gray-400">
              This removes the comment for good. It cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="mb-4 text-sm text-red-400">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteId(null);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded bg-white/5 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </section>
  );
}
