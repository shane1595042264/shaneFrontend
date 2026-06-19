import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface TeaEntrySummary {
  id: string;
  authorId: string;
  title: string | null;
  contentExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeaEntryFull {
  id: string;
  authorId: string;
  authorTimezone: string | null;
  title: string | null;
  content: string;
  /** Only present when the viewer is the author. */
  pin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeaEntryResponse {
  entry: TeaEntryFull;
  isAuthor: boolean;
}

export class TeaPinRequiredError extends Error {
  /**
   * Author of the locked entry. The detail page uses this to look up a cached
   * per-author PIN in localStorage and auto-retry without prompting (SHAN-320).
   * Optional because older API responses may not include it.
   */
  readonly authorId?: string;
  constructor(authorId?: string) {
    super("TEA_PIN_REQUIRED");
    this.name = "TeaPinRequiredError";
    this.authorId = authorId;
  }
}

export class TeaPinIncorrectError extends Error {
  constructor() {
    super("TEA_PIN_INCORRECT");
    this.name = "TeaPinIncorrectError";
  }
}

export class TeaPinRateLimitedError extends Error {
  readonly retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super("TEA_PIN_RATE_LIMITED");
    this.name = "TeaPinRateLimitedError";
    this.retryAfterSec = retryAfterSec;
  }
}

export async function createTeaEntry(input: {
  title?: string | null;
  content: string;
  pin: string;
}): Promise<{ entry: TeaEntryFull }> {
  const res = await fetch(`${API_URL}/api/tea-entries`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title ?? null,
      content: input.content,
      pin: input.pin,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to create tea entry");
  }
  return res.json();
}

export async function listMyTeaEntries(): Promise<{ entries: TeaEntrySummary[] }> {
  const res = await fetch(`${API_URL}/api/tea-entries`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to list tea entries");
  return res.json();
}

// Public teaser feed — every tea entry's title + excerpt + timestamps, no
// auth headers attached so the response is cacheable. Detail clicks still
// pass through the PIN gate.
export async function listPublicTeaEntries(): Promise<{ entries: TeaEntrySummary[] }> {
  const res = await fetch(`${API_URL}/api/tea-entries/public`);
  if (!res.ok) throw new Error("Failed to list public tea entries");
  return res.json();
}

export async function getTeaEntry(id: string, pin?: string): Promise<TeaEntryResponse> {
  const headers: Record<string, string> = { ...getAuthHeaders() };
  if (pin) headers["X-Tea-Pin"] = pin;
  const res = await fetch(`${API_URL}/api/tea-entries/${id}`, { headers });
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    throw new TeaPinRequiredError(typeof body?.authorId === "string" ? body.authorId : undefined);
  }
  if (res.status === 403) throw new TeaPinIncorrectError();
  if (res.status === 429) {
    const header = res.headers.get("Retry-After");
    const parsed = header ? parseInt(header, 10) : NaN;
    throw new TeaPinRateLimitedError(Number.isFinite(parsed) && parsed > 0 ? parsed : 60);
  }
  if (res.status === 404) {
    const e = new Error("TEA_NOT_FOUND");
    throw e;
  }
  if (!res.ok) throw new Error("Failed to fetch tea entry");
  return res.json();
}

export async function updateTeaEntry(
  id: string,
  patch: { title?: string | null; content?: string; pin?: string },
): Promise<TeaEntryResponse> {
  const res = await fetch(`${API_URL}/api/tea-entries/${id}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update tea entry");
  }
  return res.json();
}

// Skip the "edited" indicator when updatedAt is within this slack of createdAt.
// ORM inserts can produce a sub-second gap that isn't a real edit.
const EDIT_SLACK_MS = 60_000;

export function teaEntryWasEdited(
  entry: { createdAt: string; updatedAt: string },
): boolean {
  return new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() >= EDIT_SLACK_MS;
}

export async function deleteTeaEntry(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/tea-entries/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete tea entry");
}
