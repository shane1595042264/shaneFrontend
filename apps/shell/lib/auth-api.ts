import { API_URL } from "@/lib/api-url";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  /** IANA timezone the user posts in. Falls back to America/Chicago server-side. */
  timezone: string;
}

export async function updateMyTimezone(timezone: string): Promise<{ timezone: string }> {
  const token = getStoredToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch(`${API_URL}/api/auth/me/timezone`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timezone }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update timezone");
  }
  return res.json();
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = "auth_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loginWithGoogle(credential: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Login failed");
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // A revoked or expired token otherwise sits in localStorage forever, so every
  // later page load keeps sending authed requests that are guaranteed to 401.
  // Only a definitive answer clears it: this route replies 200 {user: null} for
  // a token it no longer recognises, and 401 if the middleware rejects it. A
  // 5xx or a proxy hiccup must never sign a good session out.
  if (res.status === 401) {
    clearStoredToken();
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.user) {
    clearStoredToken();
    return null;
  }
  return data.user;
}
