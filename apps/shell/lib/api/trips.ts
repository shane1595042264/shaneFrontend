import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";

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

export interface ExistingTripRef {
  slug: string;
  title: string | null;
  createdAt: string;
}

/**
 * Thrown when the backend recognizes an upload as a trip that already exists
 * (SHAN-514). Carries the existing trip so the caller can offer "open the one
 * you already have" instead of rendering a dead-end error string. Re-calling
 * uploadTripFile with `{ force: true }` creates the copy anyway.
 */
export class DuplicateTripError extends Error {
  readonly existing: ExistingTripRef;

  constructor(message: string, existing: ExistingTripRef) {
    super(message);
    this.name = "DuplicateTripError";
    this.existing = existing;
  }
}

export async function uploadTripFile(
  file: File,
  title?: string,
  opts: { force?: boolean } = {},
): Promise<{ slug: string; title: string | null }> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  if (opts.force) form.append("force", "true");
  const res = await fetch(`${API_URL}/api/trips`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 409 && err.code === "duplicate_trip" && err.existing) {
      throw new DuplicateTripError(
        err.error || "This trip has already been uploaded",
        err.existing,
      );
    }
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
