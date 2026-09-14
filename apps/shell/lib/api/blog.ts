// apps/shell/lib/api/blog.ts
//
// SHAN-478 Phase 2. Read client for the public blog (backend module shipped in
// SHAN-481). Unlike lib/api/journal.ts there is no auth header on the reads:
// every GET here is answerable anonymously, which is the entire point of the
// element. Auth is still forwarded when present so the author sees their own
// drafts in the list, exactly as the backend's optionalAuth allows.
import { getAuthHeaders } from "@/lib/auth-api";
import { revalidateBlogPost } from "@/lib/blog-revalidate";
import { API_URL, BACKEND_ORIGIN } from "@/lib/api-url";

export interface BlogAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  authorId: string;
  /** IANA timezone snapshot of the author at create-time. */
  authorTimezone: string | null;
  author: BlogAuthor | null;
  currentVersionId: string | null;
  status: "published" | "draft" | "trashed";
  /**
   * Cover art. Relative (`/api/journal/images/<id>`) as stored — run it through
   * `coverSrc()` before putting it in an `<img>`, because a relative backend
   * path does not resolve against shanejli.com. Null when the post has none.
   */
  coverImageUrl: string | null;
  tags: string[];
  editCount: number;
  /**
   * Denormalized comment count (SHAN-488) so a tile can show one without the
   * index fanning out a query per post. Optional because a cached ISR payload
   * rendered before that column existed will not carry it.
   */
  commentCount?: number;
  /** Ordering key and keyset cursor. */
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  /** First ~500 chars of the current body, windowed around the `q` hit when searching. */
  contentExcerpt: string | null;
}

/** SHAN-495: just enough to label a prev/next link, never a whole post. */
export interface BlogPostNeighbor {
  slug: string;
  title: string;
}

export interface BlogPostDetail {
  post: BlogPost;
  author: BlogAuthor | null;
  title: string;
  content: string;
  currentVersionNum: number;
  /**
   * SHAN-495. The chronologically older and newer published posts, or null at
   * either end of the archive. Published only, even when the post itself is a
   * draft its author is previewing.
   */
  prev: BlogPostNeighbor | null;
  next: BlogPostNeighbor | null;
}

export interface BlogPostPage {
  posts: BlogPost[];
  /** publishedAt of the last row, or null when this was the final page. */
  nextCursor: string | null;
}

export interface ListPostsOptions {
  tag?: string | null;
  q?: string | null;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

export function buildPostsQuery(opts: ListPostsOptions): string {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.tag) qs.set("tag", opts.tag);
  if (opts.q) qs.set("q", opts.q);
  if (opts.cursor) qs.set("cursor", opts.cursor);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function listPosts(opts: ListPostsOptions = {}): Promise<BlogPostPage> {
  const res = await fetch(`${API_URL}/api/blog/posts${buildPostsQuery(opts)}`, {
    headers: { ...getAuthHeaders() },
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Failed to load posts (${res.status})`);
  }
  return res.json();
}

/** Null on 404 so callers can render a not-found state instead of an error one. */
export async function getPost(slug: string): Promise<BlogPostDetail | null> {
  const res = await fetch(`${API_URL}/api/blog/posts/${encodeURIComponent(slug)}`, {
    headers: { ...getAuthHeaders() },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Failed to load post (${res.status})`);
  }
  return res.json();
}

/**
 * Resolve a stored cover value to something an `<img src>` can load.
 *
 * Covers are stored relative (`/api/journal/images/<id>`) so they survive a
 * backend origin change, but a relative backend path does not resolve against
 * shanejli.com in the browser and resolves against nothing at all during SSR.
 * Absolute https covers pass through untouched.
 */
export function coverSrc(coverImageUrl: string | null | undefined): string | null {
  if (!coverImageUrl) return null;
  return coverImageUrl.startsWith("/") ? `${BACKEND_ORIGIN}${coverImageUrl}` : coverImageUrl;
}

/**
 * A row from `GET /posts/:slug/versions`. Metadata only — the backend leaves
 * bodies out of the list on purpose (versions are never pruned), so fetch one
 * with `getPostVersion` when you need to show it.
 */
export interface BlogVersion {
  id: string;
  postId: string;
  versionNum: number;
  title: string;
  contentHash: string;
  editorId: string;
  editor: BlogAuthor | null;
  source: "direct" | "revert";
  parentVersionId: string | null;
  createdAt: string;
}

/** One version from `GET /posts/:slug/versions/:num` — the row with the body. */
export interface BlogVersionDetail extends Omit<BlogVersion, "editor"> {
  content: string;
}

/** Fields a compose or edit form can send. Omitted keys are left untouched. */
export interface PostWrite {
  title?: string;
  content?: string;
  tags?: string[];
  status?: "published" | "draft";
  /** Explicit null clears the cover; undefined leaves it alone. */
  coverImageUrl?: string | null;
}

/** Thrown on 409 so callers can show the server's current version number. */
export interface VersionConflict extends Error {
  currentVersionNum?: number;
}

function conflictError(body: { currentVersionNum?: number }): VersionConflict {
  const e = new Error("VERSION_CONFLICT") as VersionConflict;
  e.currentVersionNum = body.currentVersionNum;
  return e;
}

/**
 * Request bodies use snake_case for the cover (matching `target_version_num`),
 * while responses come back as the camelCase drizzle row. Kept in one place so
 * no caller has to remember which side of the wire it is on.
 */
function toWireBody(patch: PostWrite): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.content !== undefined) out.content = patch.content;
  if (patch.tags !== undefined) out.tags = patch.tags;
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.coverImageUrl !== undefined) out.cover_image_url = patch.coverImageUrl;
  return out;
}

export async function createPost(
  input: PostWrite & { title: string; content: string },
): Promise<{ post: BlogPost; currentVersionNum: number }> {
  const res = await fetch(`${API_URL}/api/blog/posts`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(toWireBody(input)),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Failed to publish (${res.status})`);
  }
  const json = (await res.json()) as { post: BlogPost; currentVersionNum: number };
  // Fire-and-forget: a revalidation failure must not lose the author's write,
  // which already committed. Worst case they wait out the ISR window.
  await revalidateBlogPost(json.post.slug).catch(() => {});
  return json;
}

/**
 * `ifMatch` is required whenever the patch carries a title or body — the
 * backend answers 428 without it. Metadata-only patches (tags, status, cover)
 * take no header.
 *
 * It goes out as X-If-Match, never If-Match (SHAN-487). Browser writes are
 * same-origin and ride the Vercel rewrite, and Vercel's edge evaluates a real
 * If-Match against the response ETag — ours are weak (the backend's
 * conditionalGet), and a weak validator can never satisfy If-Match's strong
 * comparison. The edit committed at the origin and then came back to the
 * browser as 412, so the editor said "failed to save" about a save that had
 * happened, and retrying wrote it again. X-If-Match is not a conditional
 * header, so no proxy touches it.
 */
export async function updatePost(
  slug: string,
  patch: PostWrite,
  ifMatch?: number,
): Promise<{ post: BlogPost; currentVersionNum: number }> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };
  if (ifMatch !== undefined) headers["X-If-Match"] = String(ifMatch);
  const res = await fetch(`${API_URL}/api/blog/posts/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(toWireBody(patch)),
  });
  if (res.status === 409) throw conflictError(await res.json().catch(() => ({})));
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Failed to save (${res.status})`);
  }
  const json = (await res.json()) as { post: BlogPost; currentVersionNum: number };
  await revalidateBlogPost(slug).catch(() => {});
  return json;
}

/** Soft delete to `trashed`. A 404 is treated as already gone, not an error. */
export async function deletePost(slug: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/blog/posts/${encodeURIComponent(slug)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete (${res.status})`);
  await revalidateBlogPost(slug).catch(() => {});
}

export async function listPostVersions(
  slug: string,
  opts: { limit?: number; cursor?: number } = {},
): Promise<{ versions: BlogVersion[]; nextCursor: number | null }> {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.cursor !== undefined) qs.set("cursor", String(opts.cursor));
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await fetch(
    `${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/versions${suffix}`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  const json = await res.json();
  return { versions: json.versions, nextCursor: json.nextCursor ?? null };
}

export async function getPostVersion(
  slug: string,
  versionNum: number,
): Promise<BlogVersionDetail> {
  const res = await fetch(
    `${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/versions/${versionNum}`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to load version ${versionNum} (${res.status})`);
  return (await res.json()).version;
}

export async function revertPost(
  slug: string,
  targetVersionNum: number,
  ifMatch: number,
): Promise<{ versionNum: number; versionId: string }> {
  const res = await fetch(`${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/revert`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
      // X-If-Match, not If-Match — see updatePost above.
      "X-If-Match": String(ifMatch),
    },
    body: JSON.stringify({ target_version_num: targetVersionNum }),
  });
  if (res.status === 409) throw conflictError(await res.json().catch(() => ({})));
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Failed to revert (${res.status})`);
  }
  const json = (await res.json()) as { versionNum: number; versionId: string };
  await revalidateBlogPost(slug).catch(() => {});
  return json;
}
