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

// ------------------------------------------------------------------
// owner-only management (SHAN-476, Phase 3 of SHAN-472)
//
// Every call below 403s for anyone but the journal owner, and 403s a PAT even
// if the owner minted it — access management is deliberately a human,
// browser-session action. Callers must therefore be client components.
// ------------------------------------------------------------------

/** A row from the access-request queue, joined to the requester's account. */
export interface JournalAccessRequest {
  id: string;
  userId: string;
  message: string | null;
  status: JournalRequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** A current member of the journal. `role: "owner"` can never be revoked. */
export interface JournalMember {
  userId: string;
  role: JournalRole;
  grantedBy: string | null;
  createdAt: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** Read an owner-only response, turning the API's `error` field into a throw. */
async function ownerJson<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || fallback);
  }
  return res.json() as Promise<T>;
}

/** The request queue. Omit `status` for every request ever made. */
export async function listAccessRequests(
  status?: JournalRequestStatus,
  init?: { signal?: AbortSignal },
): Promise<JournalAccessRequest[]> {
  const query = status ? `?status=${status}` : "";
  const res = await fetch(`${API_URL}/api/journal/access/requests${query}`, {
    headers: getAuthHeaders(),
    signal: init?.signal,
  });
  const body = await ownerJson<{ requests: JournalAccessRequest[] }>(
    res,
    "Failed to load access requests",
  );
  return body.requests;
}

export async function approveAccessRequest(id: string): Promise<JournalAccessRequest> {
  const res = await fetch(`${API_URL}/api/journal/access/requests/${id}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return (await ownerJson<{ request: JournalAccessRequest }>(res, "Couldn't approve that request"))
    .request;
}

export async function rejectAccessRequest(id: string): Promise<JournalAccessRequest> {
  const res = await fetch(`${API_URL}/api/journal/access/requests/${id}/reject`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return (await ownerJson<{ request: JournalAccessRequest }>(res, "Couldn't reject that request"))
    .request;
}

export async function listJournalMembers(
  init?: { signal?: AbortSignal },
): Promise<JournalMember[]> {
  const res = await fetch(`${API_URL}/api/journal/access/members`, {
    headers: getAuthHeaders(),
    signal: init?.signal,
  });
  return (await ownerJson<{ members: JournalMember[] }>(res, "Failed to load members")).members;
}

/**
 * Invite by email. Identity comes from Google OAuth, so the backend 404s when
 * nobody has ever signed in with that address — translated here into guidance,
 * because "404" is not something the owner can act on but "have them sign in
 * once first" is.
 */
export async function inviteJournalMember(
  email: string,
): Promise<{ id: string; email: string; name: string | null }> {
  const res = await fetch(`${API_URL}/api/journal/access/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ email }),
  });
  if (res.status === 404) {
    throw new Error(
      `No account has signed in with ${email} yet. Ask them to sign in with Google once, then invite them again.`,
    );
  }
  return (
    await ownerJson<{ member: { id: string; email: string; name: string | null } }>(
      res,
      "Couldn't send that invite",
    )
  ).member;
}

/** Revoke a membership. The backend refuses to delete the owner row (404). */
export async function revokeJournalMember(userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/journal/access/members/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || "Couldn't remove that member");
  }
}
