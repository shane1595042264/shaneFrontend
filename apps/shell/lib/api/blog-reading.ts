import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";
import type { CapturedPosition, ReadingAnchor } from "@/lib/reading-position";

// SHAN-705: where the signed-in reader left off in each blog post, the blog's
// twin of lib/api/journal-reading.ts. Browser session only. Signed-out readers
// never call this: their position stays on their device (see
// components/blog/blog-reading.tsx).

export interface BlogReadingPosition {
  slug: string;
  title: string;
  progress: number;
  anchor: ReadingAnchor;
  updatedAt: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/blog/reading${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Reading position request failed");
  return body as T;
}

/** Most recently read first. */
export const listBlogReadingPositions = (limit = 100) =>
  call<{ positions: BlogReadingPosition[] }>(`?limit=${limit}`).then((r) => r.positions);

export const getBlogReadingPosition = (slug: string) =>
  call<{ position: BlogReadingPosition | null }>(`/${encodeURIComponent(slug)}`).then((r) => r.position);

/** keepalive so the save outlives a closing tab, as on the journal. */
export const saveBlogReadingPosition = (slug: string, pos: CapturedPosition, opts?: { keepalive?: boolean }) =>
  call<{ position: BlogReadingPosition }>(`/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(pos),
    keepalive: opts?.keepalive ?? false,
  }).then((r) => r.position);
