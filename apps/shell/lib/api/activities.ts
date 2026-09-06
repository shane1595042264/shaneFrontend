import { API_URL } from "@/lib/api-url";

export interface Activity {
  id: string;
  date: string;
  source: string;
  type: string;
  data: Record<string, unknown>;
}

export async function getActivities(date: string): Promise<Activity[]> {
  try {
    const res = await fetch(`${API_URL}/api/activities/${date}`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()).activities;
  } catch {
    return [];
  }
}
