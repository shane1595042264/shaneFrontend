import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface TripGroupSummary {
  id: string;
  slug: string;
  title: string;
  ownerId: string;
  isOwner: boolean;
  memberCount: number;
  ideaCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripGroupMember {
  userId: string;
  name: string | null;
  role: string;
  joinedAt: string;
}

export interface TripIdea {
  id: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface ItineraryActivity {
  time: string | null;
  title: string;
  notes: string | null;
}

export interface DayMeals {
  breakfast?: string | null;
  lunch?: string | null;
  dinner?: string | null;
}

export interface ItineraryDay {
  day: number;
  title: string;
  /** Calendar date "YYYY-MM-DD", or null for floating trips (SHAN-277). */
  date?: string | null;
  location: string | null;
  /** Country for collapsible grouping (SHAN-277). */
  country?: string | null;
  /** Meal places — timeline fixtures, not activities (SHAN-282). */
  meals?: DayMeals | null;
  activities: ItineraryActivity[];
}

export interface TripItinerary {
  summary: string;
  days: ItineraryDay[];
}

export interface TripGroupDetail {
  id: string;
  slug: string;
  title: string;
  ownerId: string;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
  itinerary: TripItinerary | null;
  itineraryGeneratedAt: string | null;
  members: TripGroupMember[];
  ideas: TripIdea[];
}

async function unwrap(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || `${fallback}: ${res.status}`);
}

export async function listMyGroups(): Promise<TripGroupSummary[]> {
  const res = await fetch(`${API_URL}/api/trip-groups`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) await unwrap(res, "Failed to list groups");
  return (await res.json()).groups;
}

export async function createGroup(title: string): Promise<{ slug: string; title: string }> {
  const res = await fetch(`${API_URL}/api/trip-groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) await unwrap(res, "Failed to create group");
  const body = await res.json();
  return { slug: body.group.slug, title: body.group.title };
}

export async function getGroupDetail(slug: string): Promise<TripGroupDetail> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) await unwrap(res, "Failed to load group");
  return (await res.json()).group;
}

export async function joinGroup(slug: string): Promise<{
  joined: boolean;
  alreadyMember: boolean;
  group: { id: string; slug: string; title: string };
}> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/join`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) await unwrap(res, "Failed to join group");
  return res.json();
}

export async function postIdea(slug: string, body: string): Promise<TripIdea> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/ideas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) await unwrap(res, "Failed to post idea");
  return (await res.json()).idea;
}

export interface TripItinerarySuggestion {
  id: string;
  authorId: string;
  authorName: string | null;
  itinerary: TripItinerary;
  changedDays: number[];
  note: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
  conflictsWith?: string[];
}

/**
 * Owner result carries `itinerary` (direct write); non-owner member result
 * carries `suggestion` (pending owner approval) — SHAN-273.
 */
export async function consolidateItinerary(slug: string): Promise<{
  itinerary?: TripItinerary;
  itineraryGeneratedAt?: string;
  suggestion?: TripItinerarySuggestion;
}> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/itinerary/consolidate`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) await unwrap(res, "Failed to consolidate itinerary");
  return res.json();
}

export async function listSuggestions(slug: string): Promise<TripItinerarySuggestion[]> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/itinerary/suggestions`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) await unwrap(res, "Failed to load suggestions");
  return (await res.json()).suggestions;
}

export async function approveSuggestion(
  slug: string,
  suggestionId: string,
): Promise<{ itinerary: TripItinerary; itineraryGeneratedAt: string }> {
  const res = await fetch(
    `${API_URL}/api/trip-groups/${slug}/itinerary/suggestions/${suggestionId}/approve`,
    { method: "POST", headers: getAuthHeaders() },
  );
  if (!res.ok) await unwrap(res, "Failed to approve suggestion");
  return res.json();
}

export async function rejectSuggestion(slug: string, suggestionId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/trip-groups/${slug}/itinerary/suggestions/${suggestionId}/reject`,
    { method: "POST", headers: getAuthHeaders() },
  );
  if (!res.ok) await unwrap(res, "Failed to reject suggestion");
}

export async function deleteIdea(slug: string, ideaId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/ideas/${ideaId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) await unwrap(res, "Failed to delete idea");
}

export interface TripGroupPhoto {
  id: string;
  day: number;
  source: "user" | "unsplash";
  uploaderId: string | null;
  /** Absolute URL, ready for an <img src>. */
  url: string;
  attribution: string | null;
  createdAt: string;
}

function absolutePhotoUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export async function listPhotos(slug: string): Promise<TripGroupPhoto[]> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/itinerary/photos`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) await unwrap(res, "Failed to load photos");
  const { photos } = await res.json();
  return photos.map((p: TripGroupPhoto) => ({ ...p, url: absolutePhotoUrl(p.url) }));
}

export async function uploadPhoto(slug: string, day: number, file: File): Promise<TripGroupPhoto> {
  const form = new FormData();
  form.append("file", file);
  form.append("day", String(day));
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/itinerary/photos`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) await unwrap(res, "Failed to upload photo");
  const { photo } = await res.json();
  return { ...photo, url: absolutePhotoUrl(photo.url) };
}

export async function deletePhoto(slug: string, photoId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/itinerary/photos/${photoId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) await unwrap(res, "Failed to delete photo");
}

export async function unsplashFill(slug: string): Promise<{
  photos: TripGroupPhoto[];
  skipped: { day: number; reason: string }[];
}> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/itinerary/photos/unsplash-fill`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) await unwrap(res, "Failed to fill photos from Unsplash");
  const body = await res.json();
  return {
    photos: (body.photos ?? []).map((p: TripGroupPhoto) => ({ ...p, url: absolutePhotoUrl(p.url) })),
    skipped: body.skipped ?? [],
  };
}

/**
 * Manual itinerary edit (SHAN-276). Owner result carries `itinerary`
 * (direct write); member result carries `suggestion` (pending approval).
 */
export async function updateItinerary(
  slug: string,
  itinerary: TripItinerary,
): Promise<{
  itinerary?: TripItinerary;
  itineraryGeneratedAt?: string;
  suggestion?: TripItinerarySuggestion;
}> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/itinerary`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ itinerary }),
  });
  if (!res.ok) await unwrap(res, "Failed to save itinerary");
  return res.json();
}

// --- Google Calendar connect + export (SHAN-278) ---

export async function getCalendarStatus(): Promise<{ connected: boolean; clientId: string }> {
  const res = await fetch(`${API_URL}/api/integrations/calendar/status`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) await unwrap(res, "Failed to check calendar connection");
  return res.json();
}

export async function connectCalendar(code: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/calendar/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) await unwrap(res, "Failed to connect Google Calendar");
}

export async function exportToCalendar(slug: string): Promise<{
  created: number;
  deletedPrevious: number;
  skippedDays: number[];
}> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/itinerary/export-calendar`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) await unwrap(res, "Failed to export itinerary");
  return res.json();
}
