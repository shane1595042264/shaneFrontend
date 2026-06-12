import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface TeaEntrySummary {
  id: string;
  authorId: string;
  title: string | null;
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
  constructor() {
    super("TEA_PIN_REQUIRED");
    this.name = "TeaPinRequiredError";
  }
}

export class TeaPinIncorrectError extends Error {
  constructor() {
    super("TEA_PIN_INCORRECT");
    this.name = "TeaPinIncorrectError";
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

export async function getTeaEntry(id: string, pin?: string): Promise<TeaEntryResponse> {
  const headers: Record<string, string> = { ...getAuthHeaders() };
  if (pin) headers["X-Tea-Pin"] = pin;
  const res = await fetch(`${API_URL}/api/tea-entries/${id}`, { headers });
  if (res.status === 401) throw new TeaPinRequiredError();
  if (res.status === 403) throw new TeaPinIncorrectError();
  if (res.status === 404) {
    const e = new Error("TEA_NOT_FOUND");
    throw e;
  }
  if (!res.ok) throw new Error("Failed to fetch tea entry");
  return res.json();
}

export async function deleteTeaEntry(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/tea-entries/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete tea entry");
}
