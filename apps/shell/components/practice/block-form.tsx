"use client";

import {
  BLOCK_KINDS,
  BLOCK_MODES,
  type BlockDraft,
  type StepDraft,
} from "@/lib/api/plans";

/**
 * The one definition of a block's prescription fields (SHAN-469).
 *
 * Shared by the create modal, which edits blocks that don't exist yet, and the
 * plan detail page, which edits saved ones. Fully controlled: the parent owns
 * the draft and receives a whole new draft on every change, so nesting inside
 * the modal's days > blocks array stays a plain immutable update.
 *
 * Bounds mirror blockInput/stepInput in shaneBackend plans-routes.ts so a value
 * the API would 400 on can't be typed here.
 */

const KIND_LABELS: Record<(typeof BLOCK_KINDS)[number], string> = {
  warmup: "Warm-up",
  skill: "Skill",
  drill: "Drill",
  strength: "Strength",
  conditioning: "Conditioning",
  mobility: "Mobility",
  cooldown: "Cool-down",
  other: "Other",
};

const inputClass =
  "mt-1 block w-full rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm";

/** Clamp a numeric input into [min, max]; empty/invalid input becomes null. */
function clampOrNull(raw: string, min: number, max: number): number | null {
  if (raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
}

export function BlockForm({
  block,
  onChange,
  idPrefix,
}: {
  block: BlockDraft;
  onChange: (next: BlockDraft) => void;
  /** Unique per rendered form so label/input pairs don't collide across blocks. */
  idPrefix: string;
}) {
  const set = (patch: Partial<BlockDraft>) => onChange({ ...block, ...patch });

  const setSteps = (steps: StepDraft[]) => set({ steps });
  const patchStep = (index: number, patch: Partial<StepDraft>) =>
    setSteps(block.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs text-gray-400">Title</span>
        <input
          id={`${idPrefix}-title`}
          type="text"
          maxLength={160}
          value={block.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Warm-up"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs text-gray-400">Kind</span>
          <select
            id={`${idPrefix}-kind`}
            value={block.kind}
            onChange={(e) => set({ kind: e.target.value as BlockDraft["kind"] })}
            className={inputClass}
          >
            {BLOCK_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="block text-xs text-gray-400">Mode</legend>
          <div className="mt-1 flex gap-2">
            {BLOCK_MODES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={block.mode === m}
                onClick={() =>
                  // Only one target column is meaningful per mode; clear the
                  // other so a mode flip can't leave a stale reps target on a
                  // timed block (the runner in Phase 3 reads by mode).
                  set(
                    m === "time"
                      ? { mode: "time", targetReps: null, targetSeconds: block.targetSeconds ?? 60 }
                      : { mode: "reps", targetSeconds: null, targetReps: block.targetReps ?? 10 },
                  )
                }
                className={`flex-1 rounded border px-3 py-1.5 text-sm ${
                  block.mode === m ? "border-white bg-white/10" : "border-white/20"
                }`}
              >
                {m === "time" ? "Time" : "Reps"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs text-gray-400">
            {block.mode === "time" ? "Seconds per set" : "Reps per set"}
          </span>
          <input
            id={`${idPrefix}-target`}
            type="number"
            min={1}
            max={block.mode === "time" ? 86400 : 1000}
            value={(block.mode === "time" ? block.targetSeconds : block.targetReps) ?? ""}
            onChange={(e) =>
              set(
                block.mode === "time"
                  ? { targetSeconds: clampOrNull(e.target.value, 1, 86400) }
                  : { targetReps: clampOrNull(e.target.value, 1, 1000) },
              )
            }
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="block text-xs text-gray-400">Sets</span>
          <input
            id={`${idPrefix}-sets`}
            type="number"
            min={1}
            max={100}
            value={block.sets}
            onChange={(e) => set({ sets: clampOrNull(e.target.value, 1, 100) ?? 1 })}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="block text-xs text-gray-400">Rest seconds</span>
          <input
            id={`${idPrefix}-rest`}
            type="number"
            min={0}
            max={3600}
            value={block.restSeconds}
            onChange={(e) => set({ restSeconds: clampOrNull(e.target.value, 0, 3600) ?? 0 })}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs text-gray-400">Notes (optional)</span>
        <textarea
          id={`${idPrefix}-notes`}
          rows={2}
          maxLength={2000}
          value={block.notes ?? ""}
          onChange={(e) => set({ notes: e.target.value || null })}
          className={inputClass}
        />
      </label>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Steps</span>
          <button
            type="button"
            onClick={() => setSteps([...block.steps, { text: "", reps: null, durationSeconds: null }])}
            disabled={block.steps.length >= 50}
            className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
          >
            + Step
          </button>
        </div>
        {block.steps.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">No steps yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {block.steps.map((step, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2">
                <input
                  type="text"
                  maxLength={300}
                  value={step.text}
                  onChange={(e) => patchStep(i, { text: e.target.value })}
                  placeholder="10 hip openers each side"
                  aria-label={`Step ${i + 1} instruction`}
                  className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={step.reps ?? ""}
                  onChange={(e) => patchStep(i, { reps: clampOrNull(e.target.value, 1, 1000) })}
                  placeholder="reps"
                  aria-label={`Step ${i + 1} reps`}
                  className="w-20 rounded border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  max={86400}
                  value={step.durationSeconds ?? ""}
                  onChange={(e) =>
                    patchStep(i, { durationSeconds: clampOrNull(e.target.value, 1, 86400) })
                  }
                  placeholder="secs"
                  aria-label={`Step ${i + 1} seconds`}
                  className="w-20 rounded border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setSteps(block.steps.filter((_, j) => j !== i))}
                  aria-label={`Remove step ${i + 1}`}
                  className="rounded border border-white/20 px-2 py-1.5 text-xs text-gray-400 hover:bg-white/5"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Strip a draft down to what the API accepts: blank steps are dropped rather
 * than sent (stepInput requires non-empty text, so one stray empty row would
 * 400 the whole plan), and blank notes collapse to null.
 */
export function cleanBlockDraft(block: BlockDraft): BlockDraft {
  return {
    ...block,
    title: block.title.trim(),
    notes: block.notes?.trim() ? block.notes.trim() : null,
    steps: block.steps
      .filter((s) => s.text.trim().length > 0)
      .map((s) => ({ ...s, text: s.text.trim() })),
  };
}
