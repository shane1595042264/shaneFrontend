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
// Throws on failure (SHAN-643): an empty array is reserved for a day the
// backend really has no rows for, so a 403 or 5xx can't read as an empty day.
export async function getActivities(date: string, signal?: AbortSignal): Promise<Activity[]> {
  const res = await fetch(`${API_URL}/api/activities/${date}`, {
    headers: getAuthHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`Failed to load activity: ${res.status}`);
  return (await res.json()).activities;
}
