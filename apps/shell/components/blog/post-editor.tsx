"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarkdownEditor } from "@shane/ui";
import { markdownComponents } from "@/lib/markdown-mermaid";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { uploadImage } from "@/lib/api/images";
import {
  coverSrc,
  createPost,
  updatePost,
  type BlogPostDetail,
  type PostWrite,
  type VersionConflict,
} from "@/lib/api/blog";

// Backend caps: tags max 10 at 40 chars each, title 200.
const MAX_TAGS = 10;
const MAX_TAG_LEN = 40;
const MAX_TITLE = 200;

/** Split the comma-separated tag field into the array the API wants. */
export function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().slice(0, MAX_TAG_LEN);
    if (t && !out.includes(t)) out.push(t);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

interface Props {
  /** Edit passes the post being edited; compose passes null. */
  existing: BlogPostDetail | null;
}

/**
 * SHAN-487. The one blog authoring form, shared by /blog/new and
 * /blog/[slug]/edit — the ticket's "model the editor on the journal's existing
 * edit flow rather than inventing a second one", taken a step further: both
 * routes are thin wrappers around this, so compose and edit cannot drift.
 *
 * The journal's editor is create-only (entries are append-only there), so the
 * genuinely new machinery here is the If-Match round trip: a title/body change
 * carries the version number we loaded, and a 409 means someone moved the post
 * under us.
 */
export function PostEditor({ existing }: Props) {
  const router = useRouter();
  const isEdit = existing !== null;
  const slug = existing?.post.slug ?? "";

  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [tagInput, setTagInput] = useState(existing?.post.tags.join(", ") ?? "");
  const [status, setStatus] = useState<"published" | "draft">(
    existing?.post.status === "draft" ? "draft" : "published",
  );
  const [cover, setCover] = useState<string | null>(existing?.post.coverImageUrl ?? null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set on a 409 so the author sees which version the server actually holds,
  // instead of a bare "save failed".
  const [conflictAt, setConflictAt] = useState<number | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  // Flipped right before an in-app navigation so the unload guard below does
  // not fire on our own router.push.
  const skipPromptRef = useRef(false);

  const initialTags = existing?.post.tags ?? [];
  const initialStatus: "published" | "draft" =
    existing?.post.status === "draft" ? "draft" : "published";
  const tags = parseTags(tagInput);
  const dirty =
    title !== (existing?.title ?? "") ||
    content !== (existing?.content ?? "") ||
    !sameTags(tags, initialTags) ||
    status !== initialStatus ||
    cover !== (existing?.post.coverImageUrl ?? null);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (skipPromptRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!discardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDiscardOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [discardOpen]);

  /** Drafts hard-404 at the edge for anonymous callers, so they read at /preview. */
  const destinationFor = (postSlug: string, s: "published" | "draft") =>
    s === "draft" ? `/blog/preview/${postSlug}` : `/blog/${postSlug}`;

  const backHref = isEdit ? destinationFor(slug, initialStatus) : "/blog";

  const leave = (href: string) => {
    skipPromptRef.current = true;
    router.push(href);
    router.refresh();
  };

  const pickCover = async (file: File) => {
    setCoverUploading(true);
    setError(null);
    try {
      const { id } = await uploadImage(file, file.name);
      // Store relative, not the absolute URL the uploader hands back: the
      // backend accepts only /api/journal/images/<uuid> or an https URL, and
      // relative keeps resolving if the backend origin ever moves.
      setCover(`/api/journal/images/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cover upload failed");
    } finally {
      setCoverUploading(false);
      // Clear the input so re-picking the same file fires onChange again.
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const submit = async () => {
    if (saving || uploading || coverUploading) return;
    setSaving(true);
    setError(null);
    setConflictAt(null);
    try {
      if (!isEdit) {
        const { post } = await createPost({
          title: title.trim(),
          content,
          tags,
          status,
          coverImageUrl: cover,
        });
        leave(destinationFor(post.slug, status));
        return;
      }

      const patch: PostWrite = {};
      if (title.trim() !== existing.title) patch.title = title.trim();
      if (content !== existing.content) patch.content = content;
      if (!sameTags(tags, initialTags)) patch.tags = tags;
      if (status !== initialStatus) patch.status = status;
      if (cover !== (existing.post.coverImageUrl ?? null)) patch.coverImageUrl = cover;

      // An empty patch is a 400 on the backend, and "I changed nothing" should
      // just take you back to the post.
      if (Object.keys(patch).length === 0) {
        leave(destinationFor(slug, status));
        return;
      }

      // Only a title/body change needs the concurrency header. Sending it on a
      // metadata-only patch would be harmless but misleading.
      const needsIfMatch = patch.title !== undefined || patch.content !== undefined;
      await updatePost(slug, patch, needsIfMatch ? existing.currentVersionNum : undefined);
      leave(destinationFor(slug, status));
    } catch (e) {
      const err = e as VersionConflict;
      if (err?.message === "VERSION_CONFLICT") {
        setConflictAt(err.currentVersionNum ?? null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
      setSaving(false);
    }
  };

  const requestCancel = () => {
    if (!dirty) {
      leave(backHref);
      return;
    }
    setDiscardOpen(true);
  };

  const coverPreview = coverSrc(cover);
  const busy = saving || uploading || coverUploading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={backHref} className="text-sm text-gray-400 hover:text-white">
        &larr; {isEdit ? "back to post" : "back to blog"}
      </Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold tracking-tight text-white">
        {isEdit ? "Edit post" : "New post"}
      </h1>

      <label
        htmlFor="post-title"
        className="block text-xs uppercase tracking-wider text-gray-400"
      >
        Title
      </label>
      <input
        id="post-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={MAX_TITLE}
        placeholder="What is this one called?"
        className="mt-1 mb-5 min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 text-lg text-white placeholder:text-gray-400 focus:border-white/40 focus:outline-none"
      />

      <MarkdownEditor
        value={content}
        onChange={setContent}
        previewComponents={markdownComponents}
        onImageUpload={uploadImage}
        onUploadingChange={setUploading}
        placeholder="Write the post in markdown. Paste an image to upload it inline."
      />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="post-tags"
            className="block text-xs uppercase tracking-wider text-gray-400"
          >
            Tags
          </label>
          <input
            id="post-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="essays, rust, travel"
            aria-describedby="post-tags-hint"
            className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-gray-400 focus:border-white/40 focus:outline-none"
          />
          <p id="post-tags-hint" className="mt-1 text-xs text-gray-400">
            Comma separated, up to {MAX_TAGS}. They become the tabs on the blog index.
          </p>
          {tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li
                  key={t}
                  className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-gray-300"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <span className="block text-xs uppercase tracking-wider text-gray-400">
            Cover image
          </span>
          {coverPreview ? (
            <div className="mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverPreview}
                alt="Cover preview"
                className="h-32 w-full rounded-md border border-white/10 object-cover"
              />
              <button
                type="button"
                onClick={() => setCover(null)}
                className="mt-2 text-xs text-gray-400 underline hover:text-white"
              >
                Remove cover
              </button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-400">
              Optional. Gives the masonry tile real art instead of an excerpt-shaped block.
            </p>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            aria-label="Upload a cover image"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickCover(f);
            }}
            className="mt-2 block w-full text-xs text-gray-400 file:mr-3 file:min-h-9 file:cursor-pointer file:rounded file:border file:border-white/20 file:bg-white/5 file:px-3 file:text-xs file:text-gray-200"
          />
          {coverUploading && <p className="mt-1 text-xs text-gray-400">Uploading cover…</p>}
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-xs uppercase tracking-wider text-gray-400">Visibility</legend>
        <div className="mt-2 flex gap-2">
          {(["published", "draft"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={`min-h-11 rounded-md border px-4 text-sm transition-colors ${
                status === s
                  ? "border-white bg-white text-black"
                  : "border-white/20 text-gray-300 hover:bg-white/5"
              }`}
            >
              {s === "published" ? "Published" : "Draft"}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {status === "draft"
            ? "Only you can read a draft. It stays out of the index, the feeds and the sitemap."
            : "Published posts are world-readable and land at the top of the index."}
        </p>
      </fieldset>

      {conflictAt !== null && (
        <div
          role="alert"
          className="mt-5 rounded-md border border-amber-400/40 bg-amber-400/5 p-4 text-sm text-amber-200"
        >
          <p>
            Someone else saved this post while you were writing
            {conflictAt ? ` (it is on v${conflictAt} now)` : ""}. Reload to pick up their
            version — nothing below has been saved, so copy anything you want to keep first.
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-3 min-h-9 rounded border border-amber-300/50 px-3 text-xs text-amber-100 hover:bg-amber-400/10"
          >
            Reload latest
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !title.trim() || !content.trim()}
          className="inline-flex min-h-11 w-full items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving
            ? "Saving…"
            : uploading || coverUploading
              ? "Waiting for upload…"
              : isEdit
                ? "Save changes"
                : status === "draft"
                  ? "Save draft"
                  : "Publish"}
        </button>
        <button
          type="button"
          onClick={requestCancel}
          disabled={saving}
          className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/20 px-4 text-sm text-gray-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Cancel
        </button>
        {isEdit && (
          <Link
            href={`/blog/${slug}/history`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/20 px-4 text-sm text-gray-200 hover:bg-white/5 sm:w-auto"
          >
            History
          </Link>
        )}
      </div>

      {discardOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDiscardOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="blog-discard-heading"
          aria-describedby="blog-discard-body"
        >
          <FocusTrappedDiv
            className="mx-4 w-full max-w-sm rounded-lg border border-white/10 bg-gray-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="blog-discard-heading" className="mb-2 text-lg font-semibold text-white">
              Discard unsaved changes?
            </h3>
            <p id="blog-discard-body" className="mb-4 text-sm text-gray-400">
              What you&apos;ve written here will be lost. This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDiscardOpen(false)}
                className="rounded bg-white/5 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10"
              >
                Keep writing
              </button>
              <button
                type="button"
                onClick={() => leave(backHref)}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500"
              >
                Discard
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </div>
  );
}
