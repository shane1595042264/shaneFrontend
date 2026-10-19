import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";
import type { CapturedPosition, ReadingAnchor } from "@/lib/reading-position";

// SHAN-597: where the signed-in reader left off in each journal entry. Browser
// session and journal membership only; the server scopes everything to them.

export interface ReadingPosition {
  date: string;
  progress: number;
  anchor: ReadingAnchor;
  updatedAt: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/journal/reading${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Reading position request failed");
  return body as T;
}

/** Most recently read first. */
export const listReadingPositions = (limit = 100) =>
  call<{ positions: ReadingPosition[] }>(`?limit=${limit}`).then((r) => r.positions);

export const getReadingPosition = (date: string) =>
  call<{ position: ReadingPosition | null }>(`/${date}`).then((r) => r.position);

/**
 * `keepalive` lets the save outlive the page: it is how the position gets out
 * when the tab is closed. Bearer auth cannot ride sendBeacon, which sends no
 * custom headers, so it is a keepalive fetch instead.
 */
export const saveReadingPosition = (date: string, pos: CapturedPosition, opts?: { keepalive?: boolean }) =>
  call<{ position: ReadingPosition }>(`/${date}`, {
    method: "PUT",
    body: JSON.stringify(pos),
    keepalive: opts?.keepalive ?? false,
  }).then((r) => r.position);
