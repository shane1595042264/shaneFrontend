// apps/shell/lib/api/suggestions.ts
import { getAuthHeaders } from "@/lib/auth-api";
import { revalidateJournalEntry } from "@/lib/journal-revalidate";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface Suggestion {
  id: string;
  entryId: string;
  proposerId: string;
  baseVersionId: string;
  proposedContent: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  suggestion: Suggestion;
  entry: {
    id: string;
    date: string;
    authorId: string;
    status: string;
    editCount: number;
    pendingSuggestionCount: number;
    currentVersionId: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export async function createSuggestion(date: string, baseVersionNum: number, content: string) {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/suggestions`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ base_version_num: baseVersionNum, proposed_content: content }),
  });
  if (res.status === 403) throw new Error("CANNOT_SUGGEST_OWN");
  if (!res.ok) throw new Error("Failed to create suggestion");
  return (await res.json()).suggestion as Suggestion;
}

export async function listSuggestions(date: string, status?: string): Promise<Suggestion[]> {
  const qs = status ? `?status=${status}` : "";
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/suggestions${qs}`);
  if (!res.ok) throw new Error("Failed to list suggestions");
  return (await res.json()).suggestions;
}

export async function getSuggestion(id: string): Promise<Suggestion> {
  const res = await fetch(`${API_URL}/api/journal/suggestions/${id}`);
  if (!res.ok) throw new Error("Failed to fetch suggestion");
  return (await res.json()).suggestion;
}

export async function approveSuggestion(id: string, ifMatch: number, date: string) {
  const res = await fetch(`${API_URL}/api/journal/suggestions/${id}/approve`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "If-Match": String(ifMatch) },
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    const e = new Error("VERSION_CONFLICT");
    (e as any).currentVersionNum = body.currentVersionNum;
    throw e;
  }
  if (!res.ok) throw new Error("Failed to approve");
  const json = (await res.json()) as { versionNum: number; versionId: string };
  await revalidateJournalEntry(date).catch(() => {});
  return json;
}

export async function rejectSuggestion(id: string, reason: string | undefined, date: string) {
  const res = await fetch(`${API_URL}/api/journal/suggestions/${id}/reject`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Failed to reject");
  const suggestion = (await res.json()).suggestion as Suggestion;
  await revalidateJournalEntry(date).catch(() => {});
  return suggestion;
}

export async function withdrawSuggestion(id: string, date: string) {
  const res = await fetch(`${API_URL}/api/journal/suggestions/${id}/withdraw`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to withdraw");
  const suggestion = (await res.json()).suggestion as Suggestion;
  await revalidateJournalEntry(date).catch(() => {});
  return suggestion;
}

export async function fetchInbox(): Promise<InboxItem[]> {
  const res = await fetch(`${API_URL}/api/journal/inbox`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch inbox");
  return (await res.json()).items;
}
