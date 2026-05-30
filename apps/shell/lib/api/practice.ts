import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface PracticeSettings {
  setsPerStrike: number;
  strikesPerLoadedLocation: number;
  locationsToSolidify: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface Prescription {
  id: string;
  itemId: string;
  setMode: "time" | "reps";
  setSize: number;
  restSeconds: number;
}

export interface Location {
  id: string;
  name: string;
  normalized: string;
  lastUsedAt: string | null;
}

export interface Session {
  id: string;
  userId: string;
  startedAt: string;
  completedAt: string | null;
  categoryFilter: string | null;
  nItemsRequested: number;
}

export interface TimerState {
  currentSet: number;
  phase: "work" | "rest";
  status: "running" | "paused";
  elapsedSeconds: number;
  lastSyncedAt: string;
}

export interface SessionItem {
  id: string;
  sessionId: string;
  itemId: string;
  position: number;
  locationId: string | null;
  locationName: string | null;
  setsCompleted: number;
  timerState: TimerState | null;
  startedAt: string | null;
  completedAt: string | null;
  // Enriched by the backend GET /sessions/:id JOINs:
  word: string;
  source: unknown;
  prescription: { setMode: "time" | "reps"; setSize: number; restSeconds: number } | null;
}

export interface PracticeableItem {
  itemId: string;
  word: string;
  category: string;
  source: unknown;
  prescription: { setMode: "time" | "reps"; setSize: number; restSeconds: number };
  totalStrikes: number;
  loadedLocations: number;
  isSolidified: boolean;
}

export interface ItemProgressDetail {
  itemId: string;
  word: string;
  prescription: { setMode: "time" | "reps"; setSize: number; restSeconds: number };
  totalStrikes: number;
  isSolidified: boolean;
  loadedLocationCount: number;
  strikesByLocation: Array<{
    locationId: string | null;
    locationName: string | null;
    strikeCount: number;
    isLoaded: boolean;
  }>;
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
  return res.json();
}

// Settings
export const getSettings = () =>
  api<{ settings: PracticeSettings }>("/api/practice/settings").then((r) => r.settings);

export const updateSettings = (patch: Partial<Omit<PracticeSettings, "updatedAt" | "updatedBy">>) =>
  api<{ settings: PracticeSettings }>("/api/practice/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.settings);

// Prescriptions
export const getPrescription = (itemId: string) =>
  fetch(`${API_URL}/api/practice/prescriptions/${itemId}`)
    .then(async (r) => (r.status === 404 ? null : ((await r.json()).prescription as Prescription)));

export const upsertPrescription = (itemId: string, body: { setMode: "time" | "reps"; setSize: number; restSeconds: number }) =>
  api<{ prescription: Prescription }>(`/api/practice/prescriptions/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }).then((r) => r.prescription);

// Locations
export const listLocations = () =>
  api<{ locations: Location[] }>("/api/practice/locations").then((r) => r.locations);

export const upsertLocation = (name: string) =>
  api<{ location: Location }>("/api/practice/locations", {
    method: "POST",
    body: JSON.stringify({ name }),
  }).then((r) => r.location);

// Sessions
export const createSessionFromGenerator = (input: { categoryFilter?: string; nItemsRequested: number; includeSolidified?: boolean }) =>
  api<{ session: Session; itemIds: string[] }>("/api/practice/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const createSessionFromItemIds = (itemIds: string[]) =>
  api<{ session: Session; itemIds: string[] }>("/api/practice/sessions", {
    method: "POST",
    body: JSON.stringify({ itemIds }),
  });

export const previewSession = (categoryFilter: string | null, n: number, includeSolidified: boolean) => {
  const qs = new URLSearchParams();
  if (categoryFilter) qs.set("category", categoryFilter);
  qs.set("n", String(n));
  if (includeSolidified) qs.set("include_solidified", "true");
  return api<{ items: PracticeableItem[] }>(`/api/practice/sessions/preview?${qs}`).then((r) => r.items);
};

export const getSession = (id: string) =>
  api<{ session: Session; items: SessionItem[] }>(`/api/practice/sessions/${id}`);

export const listMySessions = () =>
  api<{ sessions: Session[] }>("/api/practice/sessions").then((r) => r.sessions);

export const completeSession = (id: string) =>
  api<{ ok: true }>(`/api/practice/sessions/${id}`, { method: "PATCH" });

// Session items / timer sync
export const syncSessionItem = (id: string, patch: {
  timerState?: TimerState | null;
  setsCompleted?: number;
  locationId?: string | null;
  locationName?: string | null;
  completedAt?: string | null;
  startedAt?: string | null;
}) =>
  api<{ sessionItem: SessionItem }>(`/api/practice/session-items/${id}/sync`, {
    method: "POST",
    body: JSON.stringify(patch),
  });

/** Fire-and-forget for pagehide. Bearer auth can't ride raw sendBeacon (no custom headers), so use fetch+keepalive. */
export function beaconSync(id: string, patch: object): void {
  const url = `${API_URL}/api/practice/session-items/${id}/sync`;
  const body = JSON.stringify(patch);
  fetch(url, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

// Aggregations
export const listPracticeableItems = (categoryFilter: string | null, includeSolidified: boolean) => {
  const qs = new URLSearchParams();
  if (categoryFilter) qs.set("category", categoryFilter);
  if (includeSolidified) qs.set("include_solidified", "true");
  return api<{ items: PracticeableItem[] }>(`/api/practice/items?${qs}`).then((r) => r.items);
};

export const getItemProgress = (itemId: string) =>
  api<{ detail: ItemProgressDetail }>(`/api/practice/items/${itemId}/progress`).then((r) => r.detail);
