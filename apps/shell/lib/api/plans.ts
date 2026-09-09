/**
 * Training plans client (SHAN-469, Phase 2 of SHAN-467).
 *
 * Mirrors the Phase 1 API at /api/practice/plans. Types track the repo rows in
 * shaneBackend/src/modules/practice/plans-repo.ts; the constant arrays track the
 * zod enums in plans-routes.ts so a value the backend would reject is not
 * offerable in the UI.
 */
import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";

export const PLAN_STATUSES = ["draft", "active", "archived"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_VISIBILITIES = ["private", "public"] as const;
export type PlanVisibility = (typeof PLAN_VISIBILITIES)[number];

export const BLOCK_KINDS = [
  "warmup",
  "skill",
  "drill",
  "strength",
  "conditioning",
  "mobility",
  "cooldown",
  "other",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_MODES = ["time", "reps"] as const;
export type BlockMode = (typeof BLOCK_MODES)[number];

export interface Plan {
  id: string;
  userId: string;
  slug: string;
  title: string;
  goal: string | null;
  description: string | null;
  discipline: string | null;
  status: PlanStatus;
  visibility: PlanVisibility;
  startDate: string | null;
  daysPerWeek: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanStep {
  id: string;
  blockId: string;
  position: number;
  text: string;
  reps: number | null;
  durationSeconds: number | null;
}

export interface PlanBlock {
  id: string;
  dayId: string;
  position: number;
  title: string;
  kind: BlockKind;
  mode: BlockMode;
  targetSeconds: number | null;
  targetReps: number | null;
  sets: number;
  restSeconds: number;
  notes: string | null;
  steps: PlanStep[];
}

export interface PlanDay {
  id: string;
  planId: string;
  position: number;
  label: string;
  weekday: number | null;
  notes: string | null;
  blocks: PlanBlock[];
}

/** GET /plans/:planId — the plan with its whole days > blocks > steps tree. */
export interface PlanTree extends Plan {
  days: PlanDay[];
}

/**
 * Draft shapes used while authoring, before anything has an id. The create
 * modal posts these straight through as the nested POST /plans body, so field
 * names match the backend's zod input rather than the row types above.
 */
export interface StepDraft {
  text: string;
  reps: number | null;
  durationSeconds: number | null;
}

export interface BlockDraft {
  title: string;
  kind: BlockKind;
  mode: BlockMode;
  targetSeconds: number | null;
  targetReps: number | null;
  sets: number;
  restSeconds: number;
  notes: string | null;
  steps: StepDraft[];
}

export interface DayDraft {
  label: string;
  weekday: number | null;
  notes: string | null;
  blocks: BlockDraft[];
}

export interface PlanDraft {
  title: string;
  goal: string | null;
  description: string | null;
  discipline: string | null;
  status: PlanStatus;
  visibility: PlanVisibility;
  startDate: string | null;
  daysPerWeek: number | null;
  days: DayDraft[];
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function emptyBlockDraft(): BlockDraft {
  return {
    title: "",
    kind: "other",
    mode: "time",
    targetSeconds: 60,
    targetReps: null,
    sets: 1,
    restSeconds: 0,
    notes: null,
    steps: [],
  };
}

export function emptyDayDraft(position: number): DayDraft {
  return { label: `Day ${position}`, weekday: null, notes: null, blocks: [] };
}

/** Human-readable prescription for a block, e.g. "3 × 60s · 30s rest". */
export function describePrescription(block: {
  mode: BlockMode;
  targetSeconds: number | null;
  targetReps: number | null;
  sets: number;
  restSeconds: number;
}): string {
  const target =
    block.mode === "time"
      ? block.targetSeconds !== null
        ? `${block.targetSeconds}s`
        : "untimed"
      : block.targetReps !== null
        ? `${block.targetReps} reps`
        : "reps";
  const sets = block.sets > 1 ? `${block.sets} × ${target}` : target;
  return block.restSeconds > 0 ? `${sets} · ${block.restSeconds}s rest` : sets;
}

// Same wrapper as lib/api/practice.ts: the backend answers { error: string } on
// most failures but some validation paths return a structured object, which
// stringifies to a useless "[object Object]".
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
    const raw = (err as { error?: unknown }).error;
    const message = typeof raw === "string" && raw ? raw : `Request failed (${res.status})`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const base = "/api/practice/plans";

// ----- Plans -----

export const listPlans = (status?: PlanStatus) => {
  const qs = status ? `?status=${status}` : "";
  return api<{ plans: Plan[] }>(`${base}${qs}`).then((r) => r.plans);
};

export const getPlan = (planId: string) =>
  api<{ plan: PlanTree }>(`${base}/${planId}`).then((r) => r.plan);

export const createPlan = (draft: PlanDraft) =>
  api<{ plan: PlanTree }>(base, { method: "POST", body: JSON.stringify(draft) }).then(
    (r) => r.plan,
  );

export const updatePlan = (
  planId: string,
  patch: Partial<
    Pick<
      Plan,
      | "title"
      | "goal"
      | "description"
      | "discipline"
      | "status"
      | "visibility"
      | "startDate"
      | "daysPerWeek"
    >
  >,
) =>
  api<{ plan: Plan }>(`${base}/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.plan);

export const deletePlan = (planId: string) =>
  api<void>(`${base}/${planId}`, { method: "DELETE" });

// ----- Days -----

export const createDay = (planId: string, body: Omit<DayDraft, "blocks">) =>
  api<{ day: PlanDay }>(`${base}/${planId}/days`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.day);

export const updateDay = (
  planId: string,
  dayId: string,
  patch: Partial<Pick<PlanDay, "label" | "weekday" | "notes" | "position">>,
) =>
  api<{ day: PlanDay }>(`${base}/${planId}/days/${dayId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.day);

export const deleteDay = (planId: string, dayId: string) =>
  api<void>(`${base}/${planId}/days/${dayId}`, { method: "DELETE" });

// ----- Blocks -----

export const createBlock = (planId: string, dayId: string, body: BlockDraft) =>
  api<{ block: PlanBlock }>(`${base}/${planId}/days/${dayId}/blocks`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.block);

export const updateBlock = (
  planId: string,
  dayId: string,
  blockId: string,
  patch: Partial<Omit<BlockDraft, "steps">> & { position?: number },
) =>
  api<{ block: PlanBlock }>(`${base}/${planId}/days/${dayId}/blocks/${blockId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.block);

export const deleteBlock = (planId: string, dayId: string, blockId: string) =>
  api<void>(`${base}/${planId}/days/${dayId}/blocks/${blockId}`, { method: "DELETE" });

/** PUT replaces the block's whole step list in one call. */
export const replaceSteps = (
  planId: string,
  dayId: string,
  blockId: string,
  steps: StepDraft[],
) =>
  api<{ steps: PlanStep[] }>(`${base}/${planId}/days/${dayId}/blocks/${blockId}/steps`, {
    method: "PUT",
    body: JSON.stringify({ steps }),
  }).then((r) => r.steps);

// ----- Completions (the tally, SHAN-471) -----

/**
 * One block ticked off on one calendar day. The backend's unique on
 * (user, block, isoDate) means the runner can POST the same triple repeatedly
 * as sets land — each write updates the row rather than stacking duplicates.
 * `completedAt` is null while a block is only partially done.
 */
export interface PlanCompletion {
  id: string;
  userId: string;
  planId: string;
  blockId: string;
  isoDate: string;
  setsCompleted: number;
  elapsedSeconds: number;
  completedAt: string | null;
}

export const recordCompletion = (
  planId: string,
  body: {
    blockId: string;
    isoDate: string;
    setsCompleted: number;
    elapsedSeconds: number;
    completed: boolean;
  },
  /** Set while persisting from a pagehide handler, where a normal fetch is cancelled. */
  keepalive = false,
) =>
  api<{ completion: PlanCompletion }>(`${base}/${planId}/completions`, {
    method: "POST",
    body: JSON.stringify(body),
    keepalive,
  }).then((r) => r.completion);

export const listCompletions = (planId: string, range?: { from?: string; to?: string }) => {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api<{ completions: PlanCompletion[] }>(`${base}/${planId}/completions${suffix}`).then(
    (r) => r.completions,
  );
};

/**
 * Target goes in the query string, not a body: the DELETE route reads it from
 * the query precisely because a payload on a DELETE can be dropped in transit.
 */
export const deleteCompletion = (planId: string, blockId: string, isoDate: string) =>
  api<void>(
    `${base}/${planId}/completions?${new URLSearchParams({ blockId, isoDate })}`,
    { method: "DELETE" },
  );
