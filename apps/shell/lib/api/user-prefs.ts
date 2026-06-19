import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface UniversalTeaPinState {
  isSet: boolean;
}

// The GET deliberately never returns the pin itself — only whether one is
// configured. The settings card uses this for the set-vs-clear copy.
export async function getUniversalTeaPinState(): Promise<UniversalTeaPinState> {
  const res = await fetch(`${API_URL}/api/user-prefs/tea-universal-pin`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to read universal PIN state");
  return res.json();
}

export async function setUniversalTeaPin(pin: string): Promise<UniversalTeaPinState> {
  const res = await fetch(`${API_URL}/api/user-prefs/tea-universal-pin`, {
    method: "PUT",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to set universal PIN");
  }
  return res.json();
}

export async function clearUniversalTeaPin(): Promise<UniversalTeaPinState> {
  const res = await fetch(`${API_URL}/api/user-prefs/tea-universal-pin`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to clear universal PIN");
  return res.json();
}
