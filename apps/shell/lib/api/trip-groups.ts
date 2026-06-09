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

export interface TripGroupDetail {
  id: string;
  slug: string;
  title: string;
  ownerId: string;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
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

export async function deleteIdea(slug: string, ideaId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/trip-groups/${slug}/ideas/${ideaId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) await unwrap(res, "Failed to delete idea");
}
