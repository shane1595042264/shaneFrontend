// apps/shell/lib/api/blog.ts
//
// SHAN-478 Phase 2. Read client for the public blog (backend module shipped in
// SHAN-481). Unlike lib/api/journal.ts there is no auth header on the reads:
// every GET here is answerable anonymously, which is the entire point of the
// element. Auth is still forwarded when present so the author sees their own
// drafts in the list, exactly as the backend's optionalAuth allows.
import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";

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
  tags: string[];
  editCount: number;
  /** Ordering key and keyset cursor. */
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  /** First ~500 chars of the current body, windowed around the `q` hit when searching. */
  contentExcerpt: string | null;
}

export interface BlogPostDetail {
  post: BlogPost;
  author: BlogAuthor | null;
  title: string;
  content: string;
  currentVersionNum: number;
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
