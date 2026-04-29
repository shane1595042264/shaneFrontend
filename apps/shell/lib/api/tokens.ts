import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface ApiToken {
  id: string;
  name: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function listTokens(): Promise<ApiToken[]> {
  const res = await fetch(`${API_URL}/api/auth/tokens`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to list tokens");
  return (await res.json()).tokens;
}

export async function mintToken(name: string, scopes: string[]): Promise<{ id: string; token: string }> {
  const res = await fetch(`${API_URL}/api/auth/tokens`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name, scopes }),
  });
  if (!res.ok) throw new Error("Failed to mint token");
  return res.json();
}

export async function revokeToken(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/tokens/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error("Failed to revoke token");
}
