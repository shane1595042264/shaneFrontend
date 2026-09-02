import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/** Everything a Blitz client needs to sync as the signed-in user. */
export interface BlitzSyncSession {
  baseUrl: string;
  accessToken: string;
  encryptKey: string;
  email: string;
  expiresAt: string;
}

/** Origin of the Blitz web app; the only window we ever hand a session to. */
export const BLITZ_ORIGIN = "https://blitz.shanejli.com";

export const BLITZ_SESSION_MESSAGE_TYPE = "blitz-sync-session";

export async function createSyncSession(): Promise<BlitzSyncSession> {
  const res = await fetch(`${API_URL}/api/blitz/sync-session`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `${res.status}`);
  }
  return res.json();
}
