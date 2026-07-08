import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type TimeOfDay = "morning" | "night";

export interface SkincareProduct {
  id: string;
  timeOfDay: TimeOfDay;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  position: number;
  startedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkincareRoutines {
  morning: SkincareProduct[];
  night: SkincareProduct[];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `${res.status}`);
  }
  // DELETE returns 204 with no body.
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const listSkincare = () => api<SkincareRoutines>("/api/skincare");

export const createProduct = (input: {
  timeOfDay: TimeOfDay;
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
}) =>
  api<{ product: SkincareProduct }>("/api/skincare", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.product);

export const updateProduct = (
  id: string,
  patch: Partial<{ timeOfDay: TimeOfDay; name: string; brand: string | null; imageUrl: string | null }>,
) =>
  api<{ product: SkincareProduct }>(`/api/skincare/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.product);

export const deleteProduct = (id: string) =>
  api<void>(`/api/skincare/${id}`, { method: "DELETE" });

/** Persist the full ordered id list for a routine; backend assigns positions by index. */
export const reorderProducts = (timeOfDay: TimeOfDay, orderedIds: string[]) =>
  api<{ reordered: number }>("/api/skincare/reorder", {
    method: "POST",
    body: JSON.stringify({ timeOfDay, orderedIds }),
  });
