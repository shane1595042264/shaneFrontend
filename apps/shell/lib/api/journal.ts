// apps/shell/lib/api/journal.ts
import { getAuthHeaders } from "@/lib/auth-api";
import { revalidateJournalEntry } from "@/lib/journal-revalidate";
import { API_URL } from "@/lib/api-url";

export interface JournalAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface JournalEntry {
  id: string;
  date: string;
  authorId: string;
  /** IANA timezone snapshot of the author at create-time. Null for pre-migration rows. */
  authorTimezone?: string | null;
  author: JournalAuthor | null;
  status: "published" | "trashed";
  editCount: number;
  pendingSuggestionCount: number;
  commentCount: number;
  appendCount: number;
  currentVersionId: string | null;
  contentExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalAppend {
  id: string;
  entryId: string;
  authorId: string;
  authorTimezone?: string | null;
  author: JournalAuthor | null;
  content: string;
  createdAt: string;
}

export interface EntryDetail {
  entry: JournalEntry;
  author: JournalAuthor | null;
  content: string;
  currentVersionNum: number;
  appends: JournalAppend[];
}

/**
 * A row from `GET /entries/:date/versions`. Metadata only: the backend stopped
 * sending `content` per row in SHAN-461, because versions are append-only and
 * the list was carrying one full copy of the entry body per edit. Fetch a body
 * with `getVersion(date, versionNum)` when you actually need to show it.
 */
export interface JournalVersion {
  id: string;
  entryId: string;
  versionNum: number;
  contentHash: string;
  editorId: string;
  editor: JournalAuthor | null;
  source: "direct" | "suggestion" | "revert";
  suggestionId: string | null;
  parentVersionId: string | null;
  createdAt: string;
}

/** One version from `GET /entries/:date/versions/:num` — the row that carries
 *  the body. No `editor` object: that endpoint returns the raw version row. */
export interface JournalVersionDetail {
  id: string;
  entryId: string;
  versionNum: number;
  content: string;
  contentHash: string;
  editorId: string;
  source: "direct" | "suggestion" | "revert";
  suggestionId: string | null;
  parentVersionId: string | null;
  createdAt: string;
}

export async function listEntries(
  opts: { from?: string; to?: string; q?: string; limit?: number; cursor?: string } = {},
  init?: RequestInit
) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) qs.set(k, String(v));
  const res = await fetch(`${API_URL}/api/journal/entries?${qs}`, init);
  if (!res.ok) throw new Error("Failed to list entries");
  return (await res.json()) as { entries: JournalEntry[]; nextCursor: string | null };
}

export async function getEntry(date: string): Promise<EntryDetail | null> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch entry");
  return res.json();
}

export async function createEntry(date: string, content: string): Promise<{ entry: JournalEntry; currentVersionNum: number }> {
  const res = await fetch(`${API_URL}/api/journal/entries`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ date, content }),
  });
  if (res.status === 409) throw new Error("ENTRY_EXISTS");
  if (!res.ok) throw new Error("Failed to create entry");
  const json = await res.json();
  await revalidateJournalEntry(date).catch(() => {});
  return json;
}

export async function listAppends(date: string): Promise<JournalAppend[]> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/appends`);
  if (!res.ok) throw new Error("Failed to list appends");
  return (await res.json()).appends;
}

export async function createAppend(date: string, content: string): Promise<JournalAppend> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/appends`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (res.status === 403) throw new Error("NOT_AUTHOR");
  if (res.status === 404) throw new Error("ENTRY_NOT_FOUND");
  if (!res.ok) throw new Error("Failed to append");
  const json = (await res.json()) as { append: JournalAppend };
  await revalidateJournalEntry(date).catch(() => {});
  return json.append;
}

export async function deleteEntry(date: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete entry");
  await revalidateJournalEntry(date).catch(() => {});
}

export async function listVersions(
  date: string,
  opts: { limit?: number; cursor?: number } = {}
): Promise<{ versions: JournalVersion[]; nextCursor: number | null }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/versions${suffix}`);
  if (!res.ok) throw new Error("Failed to list versions");
  const json = await res.json();
  // Coalesce a missing nextCursor to null. The two repos deploy independently,
  // so for a few minutes this client can be talking to a backend that predates
  // the paginated response; undefined would read as "there is more" and the
  // load-more control would re-fetch page one forever.
  return { versions: json.versions, nextCursor: json.nextCursor ?? null };
}

export async function getVersion(date: string, versionNum: number): Promise<JournalVersionDetail> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/versions/${versionNum}`);
  if (!res.ok) throw new Error("Failed to fetch version");
  return (await res.json()).version;
}

export async function revertEntry(date: string, targetVersionNum: number, ifMatch: number) {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/revert`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json", "If-Match": String(ifMatch) },
    body: JSON.stringify({ target_version_num: targetVersionNum }),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    const e = new Error("VERSION_CONFLICT");
    (e as any).currentVersionNum = body.currentVersionNum;
    throw e;
  }
  if (!res.ok) throw new Error("Failed to revert");
  const json = (await res.json()) as { versionNum: number; versionId: string };
  await revalidateJournalEntry(date).catch(() => {});
  return json;
}
