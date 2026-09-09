"use client";

import { useEffect, useState } from "react";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { BlockForm, cleanBlockDraft } from "@/components/practice/block-form";
import {
  PLAN_STATUSES,
  WEEKDAY_LABELS,
  createPlan,
  emptyBlockDraft,
  emptyDayDraft,
  type BlockDraft,
  type DayDraft,
  type PlanStatus,
  type PlanTree,
} from "@/lib/api/plans";

/**
 * Manual plan authoring (SHAN-469).
 *
 * The API is agent-first — POST /plans takes the whole days > blocks > steps
 * tree in one request — so this modal builds that same tree in local state and
 * submits it as a single call rather than walking the nested routes. That keeps
 * a half-authored plan from being persisted when the user abandons the form.
 */

const inputClass =
  "mt-1 block w-full rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm";

const STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export function PlanModal({
  onCreated,
  onCancel,
}: {
  onCreated: (plan: PlanTree) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [status, setStatus] = useState<PlanStatus>("draft");
  const [startDate, setStartDate] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("");
  const [days, setDays] = useState<DayDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes, matching the other dialogs on the site. Guarded on `saving`
  // so a mid-flight create can't be dismissed and orphan its response.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  const patchDay = (index: number, patch: Partial<DayDraft>) =>
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const patchBlock = (dayIndex: number, blockIndex: number, next: BlockDraft) =>
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? { ...d, blocks: d.blocks.map((b, j) => (j === blockIndex ? next : b)) }
          : d,
      ),
    );

  const submit = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    // Every day and block needs a label the API will accept; catching it here
    // beats a 400 that names a nested array index the user can't map to a row.
    const cleanedDays = days.map((d) => ({
      ...d,
      label: d.label.trim(),
      notes: d.notes?.trim() ? d.notes.trim() : null,
      blocks: d.blocks.map(cleanBlockDraft),
    }));
    if (cleanedDays.some((d) => !d.label)) {
      setError("Every day needs a label.");
      return;
    }
    if (cleanedDays.some((d) => d.blocks.some((b) => !b.title))) {
      setError("Every block needs a title.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const plan = await createPlan({
        title: title.trim(),
        goal: goal.trim() || null,
        description: null,
        discipline: discipline.trim() || null,
        status,
        visibility: "private",
        startDate: startDate || null,
        daysPerWeek: daysPerWeek ? Number(daysPerWeek) : null,
        days: cleanedDays,
      });
      onCreated(plan);
    } catch (e) {
      setError((e as Error).message ?? "Failed to create plan");
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onClick={() => !saving && onCancel()}
    >
      <FocusTrappedDiv
        className="my-8 w-full max-w-2xl rounded-lg border border-white/10 bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="plan-modal-title" className="mb-4 text-lg font-semibold">
          New training plan
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs text-gray-400">Title</span>
            <input
              type="text"
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Handstand foundations"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="block text-xs text-gray-400">Goal (optional)</span>
            <textarea
              rows={2}
              maxLength={2000}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Hold a freestanding handstand for 30 seconds"
              className={inputClass}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs text-gray-400">Discipline (optional)</span>
              <input
                type="text"
                maxLength={60}
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="Calisthenics"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="block text-xs text-gray-400">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlanStatus)}
                className={inputClass}
              >
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs text-gray-400">Start date (optional)</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="block text-xs text-gray-400">Days per week (optional)</span>
              <input
                type="number"
                min={1}
                max={7}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wider text-gray-400">
            Days
          </h3>
          <button
            type="button"
            onClick={() => setDays((prev) => [...prev, emptyDayDraft(prev.length + 1)])}
            disabled={days.length >= 60}
            className="rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
          >
            + Day
          </button>
        </div>

        {days.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">
            No days yet. Add one, or create the plan now and build it out on the plan page.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {days.map((day, dayIndex) => (
              <li
                key={dayIndex}
                className="rounded-md border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="block text-xs text-gray-400">Day label</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={day.label}
                      onChange={(e) => patchDay(dayIndex, { label: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="w-40">
                    <span className="block text-xs text-gray-400">Weekday</span>
                    <select
                      value={day.weekday ?? ""}
                      onChange={(e) =>
                        patchDay(dayIndex, {
                          weekday: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Any day</option>
                      {WEEKDAY_LABELS.map((label, i) => (
                        <option key={label} value={i}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDays((prev) => prev.filter((_, i) => i !== dayIndex))}
                    aria-label={`Remove day ${dayIndex + 1}`}
                    className="mt-5 rounded border border-white/20 px-2 py-1.5 text-xs text-gray-400 hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Blocks</span>
                  <button
                    type="button"
                    onClick={() =>
                      patchDay(dayIndex, { blocks: [...day.blocks, emptyBlockDraft()] })
                    }
                    disabled={day.blocks.length >= 50}
                    className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
                  >
                    + Block
                  </button>
                </div>

                {day.blocks.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-400">No blocks yet.</p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {day.blocks.map((block, blockIndex) => (
                      <li
                        key={blockIndex}
                        className="rounded border border-white/10 bg-black/30 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            Block {blockIndex + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              patchDay(dayIndex, {
                                blocks: day.blocks.filter((_, j) => j !== blockIndex),
                              })
                            }
                            aria-label={`Remove block ${blockIndex + 1} of day ${dayIndex + 1}`}
                            className="rounded border border-white/20 px-2 py-1 text-xs text-gray-400 hover:bg-white/5"
                          >
                            ✕
                          </button>
                        </div>
                        <BlockForm
                          block={block}
                          onChange={(next) => patchBlock(dayIndex, blockIndex, next)}
                          idPrefix={`plan-modal-d${dayIndex}-b${blockIndex}`}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded bg-white px-4 py-2 text-sm text-black hover:bg-gray-200 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create plan"}
          </button>
        </div>
      </FocusTrappedDiv>
    </div>
  );
}
