"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { InlineErrorState } from "@/components/inline-error-state";
import { BlockForm, cleanBlockDraft } from "@/components/practice/block-form";
import {
  PLAN_STATUSES,
  WEEKDAY_LABELS,
  createBlock,
  createDay,
  deleteBlock,
  deleteDay,
  deletePlan,
  describePrescription,
  emptyBlockDraft,
  getPlan,
  replaceSteps,
  updateBlock,
  updateDay,
  updatePlan,
  type BlockDraft,
  type PlanBlock,
  type PlanDay,
  type PlanStatus,
  type PlanTree,
} from "@/lib/api/plans";

const STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

const inputClass = "rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm";
const ghostButton =
  "rounded border border-white/20 px-2 py-1 text-xs text-gray-400 hover:bg-white/5 disabled:opacity-50";

/** A saved block turned back into the draft shape BlockForm edits. */
function blockToDraft(block: PlanBlock): BlockDraft {
  return {
    title: block.title,
    kind: block.kind,
    mode: block.mode,
    targetSeconds: block.targetSeconds,
    targetReps: block.targetReps,
    sets: block.sets,
    restSeconds: block.restSeconds,
    notes: block.notes,
    steps: block.steps.map((s) => ({
      text: s.text,
      reps: s.reps,
      durationSeconds: s.durationSeconds,
    })),
  };
}

/**
 * Destructive actions use a two-click confirm rather than window.confirm: a
 * native modal blocks the page (and every browser-automation E2E run) until
 * it's dismissed.
 */
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  ariaLabel,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={armed ? `${ghostButton} border-red-500/60 text-red-400` : ghostButton}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

function PlanDetailContent({ planId }: { planId: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanTree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Block id currently open in the editor, or `day:<dayId>` while adding one.
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [addingForDayId, setAddingForDayId] = useState<string | null>(null);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);

  const load = useCallback(() => {
    setError(null);
    setPlan(null);
    getPlan(planId)
      .then(setPlan)
      .catch((e) => setError((e as Error).message ?? "Failed to load"));
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  // Every mutation refetches the tree rather than patching local state: the
  // backend owns positions, and a stale position is how a day list silently
  // reorders itself after an edit.
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      setPlan(await getPlan(planId));
    } catch (e) {
      setActionError((e as Error).message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const closeBlockEditor = () => {
    setEditingBlockId(null);
    setAddingForDayId(null);
    setBlockDraft(null);
  };

  const saveBlock = async (day: PlanDay, blockId: string | null) => {
    if (!blockDraft) return;
    const clean = cleanBlockDraft(blockDraft);
    if (!clean.title) {
      setActionError("Block title is required.");
      return;
    }
    await run(async () => {
      if (blockId === null) {
        await createBlock(planId, day.id, clean);
        return;
      }
      const { steps, ...fields } = clean;
      await updateBlock(planId, day.id, blockId, fields);
      await replaceSteps(planId, day.id, blockId, steps);
    });
    closeBlockEditor();
  };

  if (error)
    return (
      <InlineErrorState
        message={error}
        onRetry={load}
        backHref="/practice/plans"
        backLabel="Back to plans"
      />
    );
  if (!plan) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/practice/plans" className="text-sm text-gray-400 hover:text-gray-300">
        ← back to plans
      </Link>

      <header className="mt-3">
        <h1 className="text-2xl font-semibold">{plan.title}</h1>
        {plan.goal && <p className="mt-2 text-sm text-gray-300">{plan.goal}</p>}
        <p className="mt-2 text-xs text-gray-400">
          {plan.discipline && <>{plan.discipline} · </>}
          {plan.daysPerWeek !== null && <>{plan.daysPerWeek}×/week · </>}
          {plan.startDate ? <>starts {plan.startDate}</> : "no start date"}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/practice/plans/${planId}/today`}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
          >
            ▶ Run today
          </Link>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            Status
            <select
              value={plan.status}
              disabled={busy}
              onChange={(e) =>
                run(() => updatePlan(planId, { status: e.target.value as PlanStatus }))
              }
              className={inputClass}
            >
              {PLAN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <ConfirmButton
            label="Delete plan"
            confirmLabel="Confirm delete plan"
            disabled={busy}
            onConfirm={async () => {
              setBusy(true);
              setActionError(null);
              try {
                await deletePlan(planId);
                router.push("/practice/plans");
              } catch (e) {
                setActionError((e as Error).message ?? "Failed to delete plan");
                setBusy(false);
              }
            }}
          />
        </div>
      </header>

      {actionError && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {actionError}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">Days</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() =>
              createDay(planId, {
                label: `Day ${plan.days.length + 1}`,
                weekday: null,
                notes: null,
              }),
            )
          }
          className="rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
        >
          + Day
        </button>
      </div>

      {plan.days.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">
          No days yet. Add one to start building the schedule.
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {plan.days.map((day) => (
            <li key={day.id} className="rounded-md border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  maxLength={120}
                  defaultValue={day.label}
                  disabled={busy}
                  aria-label={`Label for ${day.label}`}
                  onBlur={(e) => {
                    const label = e.target.value.trim();
                    if (!label || label === day.label) {
                      e.target.value = day.label;
                      return;
                    }
                    run(() => updateDay(planId, day.id, { label }));
                  }}
                  className={`min-w-0 flex-1 font-medium ${inputClass}`}
                />
                <select
                  value={day.weekday ?? ""}
                  disabled={busy}
                  aria-label={`Weekday for ${day.label}`}
                  onChange={(e) =>
                    run(() =>
                      updateDay(planId, day.id, {
                        weekday: e.target.value === "" ? null : Number(e.target.value),
                      }),
                    )
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
                <ConfirmButton
                  label="Delete"
                  confirmLabel="Confirm"
                  disabled={busy}
                  ariaLabel={`Delete ${day.label}`}
                  onConfirm={() => run(() => deleteDay(planId, day.id))}
                />
              </div>

              {day.notes && <p className="mt-2 text-xs text-gray-400">{day.notes}</p>}

              <ul className="mt-4 space-y-2">
                {day.blocks.map((block) =>
                  editingBlockId === block.id && blockDraft ? (
                    <li
                      key={block.id}
                      className="rounded border border-white/20 bg-black/30 p-3"
                    >
                      <BlockForm
                        block={blockDraft}
                        onChange={setBlockDraft}
                        idPrefix={`edit-${block.id}`}
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={closeBlockEditor}
                          disabled={busy}
                          className="rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveBlock(day, block.id)}
                          disabled={busy}
                          className="rounded bg-white px-3 py-1.5 text-xs text-black hover:bg-gray-200 disabled:opacity-50"
                        >
                          {busy ? "Saving…" : "Save block"}
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={block.id}
                      className="rounded border border-white/10 bg-black/30 p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-white">{block.title}</h3>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {block.kind} · {describePrescription(block)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Edit ${block.title}`}
                            onClick={() => {
                              setAddingForDayId(null);
                              setEditingBlockId(block.id);
                              setBlockDraft(blockToDraft(block));
                            }}
                            className={ghostButton}
                          >
                            Edit
                          </button>
                          <ConfirmButton
                            label="Delete"
                            confirmLabel="Confirm"
                            disabled={busy}
                            ariaLabel={`Delete ${block.title}`}
                            onConfirm={() => run(() => deleteBlock(planId, day.id, block.id))}
                          />
                        </div>
                      </div>
                      {block.notes && (
                        <p className="mt-2 text-xs text-gray-400">{block.notes}</p>
                      )}
                      {block.steps.length > 0 && (
                        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-gray-300">
                          {block.steps.map((step) => (
                            <li key={step.id}>
                              {step.text}
                              {step.reps !== null && (
                                <span className="text-gray-400"> · {step.reps} reps</span>
                              )}
                              {step.durationSeconds !== null && (
                                <span className="text-gray-400">
                                  {" "}
                                  · {step.durationSeconds}s
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ),
                )}

                {addingForDayId === day.id && blockDraft ? (
                  <li className="rounded border border-white/20 bg-black/30 p-3">
                    <BlockForm
                      block={blockDraft}
                      onChange={setBlockDraft}
                      idPrefix={`new-${day.id}`}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeBlockEditor}
                        disabled={busy}
                        className="rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveBlock(day, null)}
                        disabled={busy}
                        className="rounded bg-white px-3 py-1.5 text-xs text-black hover:bg-gray-200 disabled:opacity-50"
                      >
                        {busy ? "Adding…" : "Add block"}
                      </button>
                    </div>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditingBlockId(null);
                        setAddingForDayId(day.id);
                        setBlockDraft(emptyBlockDraft());
                      }}
                      className="rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                    >
                      + Block
                    </button>
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PlanDetailPage() {
  const params = useParams<{ planId: string }>();
  return (
    <AuthGate>
      <PlanDetailContent planId={params.planId} />
    </AuthGate>
  );
}
