"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { InlineErrorState } from "@/components/inline-error-state";
import { PlanRunner } from "@/components/practice/plan-runner";
import { getPlan, type PlanTree } from "@/lib/api/plans";

function TodayContent({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<PlanTree | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  return <PlanRunner plan={plan} />;
}

export default function PlanTodayPage() {
  const params = useParams<{ planId: string }>();
  return (
    <AuthGate>
      <TodayContent planId={params.planId} />
    </AuthGate>
  );
}
