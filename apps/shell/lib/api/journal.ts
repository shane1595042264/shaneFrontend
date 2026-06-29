// apps/shell/lib/api/journal.ts
import { getAuthHeaders } from "@/lib/auth-api";
import { revalidateJournalEntry } from "@/lib/journal-revalidate";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

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

export interface JournalVersion {
  id: string;
  entryId: string;
  versionNum: number;
  content: string;
  contentHash: string;
  editorId: string;
  editor: JournalAuthor | null;
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

export async function listVersions(date: string): Promise<JournalVersion[]> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/versions`);
  if (!res.ok) throw new Error("Failed to list versions");
  return (await res.json()).versions;
}

export async function getVersion(date: string, versionNum: number): Promise<JournalVersion> {
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
