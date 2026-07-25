import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface PracticeSettings {
  setsPerStrike: number;
  strikesPerLoadedLocation: number;
  locationsToSolidify: number;
  vocabIntervalL1Days: number;
  vocabIntervalL2Days: number;
  vocabLapseIntervalDays: number;
  vocabLevelToMemorize: number;
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
  // Vocab practice mode (2026-07-24). Optional so existing workout code is unaffected.
  mode?: "workout" | "vocab";
  locationId?: string | null;
  locationName?: string | null;
  locationNormalized?: string | null;
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
  lastPracticedAt: string | null;
}

export interface ItemProgressDetail {
  itemId: string;
  word: string;
  prescription: { setMode: "time" | "reps"; setSize: number; restSeconds: number };
  totalStrikes: number;
  isSolidified: boolean;
  loadedLocationCount: number;
  lastPracticedAt: string | null;
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
    // The backend usually returns { error: "message" }, but some validation
    // paths return a structured object. Coercing that into `new Error(...)`
    // yields the useless "[object Object]"; fall back to a status-based message.
    const raw = (err as { error?: unknown }).error;
    const message = typeof raw === "string" && raw ? raw : `Request failed (${res.status})`;
    throw new Error(message);
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

// ----- Vocab mode (Shanbay-style flashcard SRS) -----

export interface VocabCard {
  itemId: string;
  word: string;
  definition: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  language: string;
  level: number;
  dueAt: string | null;
}

export interface VocabReviewResult {
  level: number;
  dueAt: string | null;
  memorized: boolean;
  longTermMemorized: boolean;
}

export interface VocabSummary {
  reviewed: number;
  remembered: number;
  forgot: number;
  leveledUp: number;
  newlyMemorized: { word: string; location: string | null }[];
}

export const createVocabSession = (locationName: string, n: number) =>
  api<{ session: Session; cards: VocabCard[] }>("/api/practice/vocab/sessions", {
    method: "POST",
    body: JSON.stringify({ locationName, n }),
  });

export const getVocabSession = (id: string) =>
  api<{ session: Session; cards: VocabCard[] }>(`/api/practice/vocab/sessions/${id}`);

export const gradeVocab = (sessionId: string, itemId: string, grade: "remember" | "forget") =>
  api<VocabReviewResult>("/api/practice/vocab/reviews", {
    method: "POST",
    body: JSON.stringify({ sessionId, itemId, grade }),
  });

export const vocabPreview = (locationName: string, n: number) => {
  const qs = new URLSearchParams({ locationName, n: String(n) });
  return api<{ dueAvailable: number; newAvailable: number }>(`/api/practice/vocab/preview?${qs}`);
};

export const getVocabSummary = (id: string) =>
  api<{ summary: VocabSummary }>(`/api/practice/vocab/sessions/${id}/summary`).then((r) => r.summary);
