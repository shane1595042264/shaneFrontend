// apps/shell/lib/api/blog-social.ts
//
// SHAN-488 Phase 4. Comments and reactions on the public blog.
//
// Separate from lib/api/blog.ts on purpose: that module is imported by the ISR
// Server Components, and every call in here is browser-only. Keeping them apart
// means a server render can never accidentally await one of these and get a 401
// for its trouble — getAuthHeaders() reads localStorage, which does not exist
// during SSR, so an authed fetch from a Server Component always fails.
//
// The reaction vocabulary (EMOJI_SET, glyphs, labels, ReactionState) is reused
// wholesale from lib/api/reactions.ts. Those constants are generic; only the
// URLs in that file are journal-specific.
import { getAuthHeaders } from "@/lib/auth-api";
import { revalidateBlogPost } from "@/lib/blog-revalidate";
import { API_URL } from "@/lib/api-url";
import type { Emoji, ReactionState } from "@/lib/api/reactions";
import type { BlogAuthor } from "@/lib/api/blog";

/**
 * One comment. Flat — there is no parentCommentId, unlike the journal's
 * one-level threads. A public post's thread is mostly the author answering
 * readers, which reads better chronologically, and it sidesteps deciding what
 * a reply should do when its parent is hard-deleted.
 */
export interface BlogComment {
  id: string;
  postId: string;
  authorId: string;
  /** IANA timezone snapshot of the author at post time. */
  authorTimezone: string | null;
  author: BlogAuthor | null;
  content: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

async function failure(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(body.error || `${fallback} (${res.status})`);
}

/**
 * Anonymous-readable. Auth is still forwarded when present, because the author
 * of a draft can read their own post's thread and the backend decides that from
 * the same header.
 */
export async function listBlogComments(slug: string): Promise<BlogComment[]> {
  const res = await fetch(
    `${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/comments`,
    { headers: { ...getAuthHeaders() }, cache: "no-store" },
  );
  if (!res.ok) throw await failure(res, "Failed to load comments");
  return (await res.json()).comments;
}

export async function postBlogComment(
  slug: string,
  content: string,
): Promise<BlogComment> {
  const res = await fetch(
    `${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/comments`,
    {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) throw await failure(res, "Failed to post comment");
  const comment = (await res.json()).comment as BlogComment;
  // Fire-and-forget: the write already committed, and a revalidation failure
  // must not surface as a failed comment. Worst case the tile's count is stale
  // until the ISR window rolls.
  await revalidateBlogPost(slug).catch(() => {});
  return comment;
}

export async function editBlogComment(
  id: string,
  content: string,
  slug: string,
): Promise<BlogComment> {
  const res = await fetch(`${API_URL}/api/blog/comments/${id}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw await failure(res, "Failed to edit comment");
  const comment = (await res.json()).comment as BlogComment;
  await revalidateBlogPost(slug).catch(() => {});
  return comment;
}

/** A 404 means it is already gone, which is the outcome the caller wanted. */
export async function deleteBlogComment(id: string, slug: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/blog/comments/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw await failure(res, "Failed to delete comment");
  await revalidateBlogPost(slug).catch(() => {});
}

/**
 * Counts for everyone, `mine` only for a signed-in reader. Never throws: a
 * failed reaction fetch should render as an empty bar, not take the page down.
 */
export async function getBlogPostReactions(slug: string): Promise<ReactionState> {
  const res = await fetch(
    `${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/reactions`,
    { headers: getAuthHeaders(), cache: "no-store" },
  );
  if (!res.ok) return { summary: [], mine: [] };
  return res.json();
}

export async function toggleBlogPostReaction(
  slug: string,
  emoji: Emoji,
): Promise<"added" | "removed"> {
  const res = await fetch(
    `${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/reactions`,
    {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    },
  );
  if (!res.ok) throw await failure(res, "Failed to toggle reaction");
  return (await res.json()).result;
}
