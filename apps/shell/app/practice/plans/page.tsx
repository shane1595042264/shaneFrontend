"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { InlineErrorState } from "@/components/inline-error-state";
import { PlanModal } from "@/components/practice/plan-modal";
import { listPlans, PLAN_STATUSES, type Plan, type PlanStatus } from "@/lib/api/plans";
import { RelativeTime } from "@/lib/format-time";

const STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

const STATUS_CLASSES: Record<PlanStatus, string> = {
  draft: "text-gray-400",
  active: "text-emerald-400",
  archived: "text-gray-400",
};

function PlansIndexContent() {
  const router = useRouter();
  const [filter, setFilter] = useState<PlanStatus | "all">("all");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setPlans(null);
    listPlans(filter === "all" ? undefined : filter)
      .then(setPlans)
      .catch((e) => setError((e as Error).message ?? "Failed to load"));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <InlineErrorState
        message={error}
        onRetry={load}
        backHref="/practice"
        backLabel="Back to practice"
      />
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/practice" className="text-sm text-gray-400 hover:text-gray-300">
        ← back
      </Link>

      <header className="mt-3 mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Training plans</h1>
          <p className="mt-2 text-sm text-gray-400">
            {plans !== null
              ? `${plans.length} plan${plans.length === 1 ? "" : "s"}${filter === "all" ? "" : ` · ${STATUS_LABELS[filter]}`}`
              : "Loading…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          ✏️ New plan
        </button>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", ...PLAN_STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
            className={`rounded border px-3 py-1.5 text-sm ${
              filter === s ? "border-white bg-white/10" : "border-white/20 hover:bg-white/5"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {plans === null ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-gray-400">
          {filter === "all"
            ? "No training plans yet. Create one, or have an agent author one through the plans API."
            : `No ${STATUS_LABELS[filter].toLowerCase()} plans.`}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/practice/plans/${plan.id}`}
                className="block h-full rounded-md border border-white/10 bg-black/20 p-4 hover:bg-black/30"
              >
                <h2 className="font-medium text-white">{plan.title}</h2>
                {plan.goal && (
                  <p className="mt-1 line-clamp-2 text-xs text-gray-400">{plan.goal}</p>
                )}
                <p className="mt-2 text-xs">
                  <span className={STATUS_CLASSES[plan.status]}>
                    {STATUS_LABELS[plan.status]}
                  </span>
                  {plan.discipline && <span className="text-gray-400"> · {plan.discipline}</span>}
                  {plan.daysPerWeek !== null && (
                    <span className="text-gray-400"> · {plan.daysPerWeek}×/week</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Updated <RelativeTime iso={plan.updatedAt} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <PlanModal
          onCreated={(plan) => {
            setModalOpen(false);
            router.push(`/practice/plans/${plan.id}`);
          }}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function PlansIndexPage() {
  return (
    <AuthGate>
      <PlansIndexContent />
    </AuthGate>
  );
}
