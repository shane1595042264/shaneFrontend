import { API_URL } from "@/lib/api-url";
import { getAuthHeaders } from "@/lib/auth-api";

export interface Activity {
  id: string;
  date: string;
  source: string;
  type: string;
  data: Record<string, unknown>;
}

// Browser-only since SHAN-583: the route is behind journal membership, and
// getAuthHeaders() reads localStorage, so a server-side call would always 403.
export async function getActivities(date: string, signal?: AbortSignal): Promise<Activity[]> {
  try {
    const res = await fetch(`${API_URL}/api/activities/${date}`, {
      headers: getAuthHeaders(),
      signal,
    });
    if (!res.ok) return [];
    return (await res.json()).activities;
  } catch {
    return [];
  }
}
