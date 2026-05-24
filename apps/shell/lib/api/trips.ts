import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface TripListItem {
  id: string;
  slug: string;
  title: string | null;
  ownerId: string;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripFull extends TripListItem {
  html: string;
  sourceFilename: string | null;
}

export async function listTrips(): Promise<TripListItem[]> {
  const res = await fetch(`${API_URL}/api/trips`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to list trips");
  return (await res.json()).trips;
}

export async function getTripBySlug(slug: string): Promise<TripFull | null> {
  const res = await fetch(`${API_URL}/api/trips/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch trip");
  return (await res.json()).trip;
}

export async function uploadTripFile(file: File, title?: string): Promise<{ slug: string; title: string | null }> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  const res = await fetch(`${API_URL}/api/trips`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  const body = await res.json();
  return { slug: body.trip.slug, title: body.trip.title };
}

export async function deleteTrip(slug: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/trips/${slug}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete trip");
}
