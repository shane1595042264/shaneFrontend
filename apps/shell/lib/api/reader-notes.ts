import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";
import type { NoteAnchor } from "@/lib/journal-notes";
import type { NoteMeta } from "@/lib/api/comments";

// SHAN-596: inline notes on blog posts and knowledge cards. Private to the
// signed-in reader; the server scopes every read and write to them.

export type ReaderSurface = "blog" | "knowledge";

export interface ReaderNote {
  id: string;
  userId: string;
  surface: ReaderSurface;
  resourceId: string;
  parentId: string | null;
  anchor: NoteAnchor | null;
  meta: NoteMeta | null;
  content: string;
  createdAt: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/reader-notes${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Notes request failed");
  return body as T;
}

export const listReaderNotes = (surface: ReaderSurface, resource: string) =>
  call<{ notes: ReaderNote[] }>(`?surface=${surface}&resource=${resource}`).then((r) => r.notes);

export const createReaderNote = (input: {
  surface: ReaderSurface;
  resource: string;
  content: string;
  anchor?: NoteAnchor;
  parentId?: string;
  meta?: NoteMeta;
}) => call<{ note: ReaderNote }>("", { method: "POST", body: JSON.stringify(input) }).then((r) => r.note);

export const deleteReaderNote = (id: string) => call<void>(`/${id}`, { method: "DELETE" });
