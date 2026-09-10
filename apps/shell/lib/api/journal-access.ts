// apps/shell/lib/api/journal-access.ts
//
// Client for the invite-only journal membership API (SHAN-474 backend,
// SHAN-475 gate). Browser-only by design: the JWT lives in localStorage, so a
// Server Component awaiting any of these would send no Authorization header
// and read back a signed-out answer.
import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";

export type JournalRole = "owner" | "member";
export type JournalRequestStatus = "pending" | "approved" | "rejected";

export interface JournalAccessState {
  role: JournalRole | null;
  requestStatus: JournalRequestStatus | null;
  requestMessage: string | null;
}

/**
 * The caller's membership. Never 401s — a signed-out caller gets the same
 * shape with nulls, so the gate renders one screen for "signed out" and
 * "signed in without access".
 */
export async function getMyJournalAccess(
  init?: { signal?: AbortSignal },
): Promise<JournalAccessState> {
  const res = await fetch(`${API_URL}/api/journal/access/me`, {
    headers: getAuthHeaders(),
    signal: init?.signal,
  });
  if (!res.ok) throw new Error(`Failed to load journal access: ${res.status}`);
  return res.json();
}

/** Ask the owner for access. Idempotent while a request is already pending. */
export async function requestJournalAccess(
  message?: string,
): Promise<{ status: JournalRequestStatus }> {
  const res = await fetch(`${API_URL}/api/journal/access/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(message ? { message } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Couldn't send your request");
  }
  const body = (await res.json()) as { request: { status: JournalRequestStatus } };
  return { status: body.request.status };
}
