"use client";

import { useState } from "react";
import { upsertPrescription } from "@/lib/api/practice";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

interface Props {
  itemId: string;
  itemName: string;
  onSaved: (prescription: { setMode: "time" | "reps"; setSize: number; restSeconds: number }) => void;
  onCancel: () => void;
}

export function PrescriptionModal({ itemId, itemName, onSaved, onCancel }: Props) {
  const [setMode, setSetMode] = useState<"time" | "reps">("time");
  const [setSize, setSetSize] = useState(60);
  const [restSeconds, setRestSeconds] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      const p = await upsertPrescription(itemId, { setMode, setSize, restSeconds });
      onSaved({ setMode: p.setMode, setSize: p.setSize, restSeconds: p.restSeconds });
    } catch (e) {
      setError((e as Error).message ?? "Failed");
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prescription-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <FocusTrappedDiv
        className="w-full max-w-sm rounded-lg border border-white/10 bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="prescription-title" className="mb-2 text-lg font-semibold">Configure practice</h3>
        <p className="mb-4 text-sm text-gray-400">{itemName}</p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setSetMode("time")} className={`flex-1 rounded border px-3 py-1.5 text-sm ${setMode === "time" ? "border-white bg-white/10" : "border-white/20"}`}>Time</button>
            <button type="button" onClick={() => setSetMode("reps")} className={`flex-1 rounded border px-3 py-1.5 text-sm ${setMode === "reps" ? "border-white bg-white/10" : "border-white/20"}`}>Reps</button>
          </div>

          <label className="block">
            <span className="block text-xs text-gray-400">{setMode === "time" ? "Seconds per set" : "Reps per set"}</span>
            <input type="number" min={1} max={3600} value={setSize} onChange={(e) => setSetSize(Math.max(1, Math.min(3600, parseInt(e.target.value, 10) || 1)))} className="mt-1 block w-full rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
          </label>

          <label className="block">
            <span className="block text-xs text-gray-400">Rest seconds between sets</span>
            <input type="number" min={0} max={3600} value={restSeconds} onChange={(e) => setRestSeconds(Math.max(0, Math.min(3600, parseInt(e.target.value, 10) || 0)))} className="mt-1 block w-full rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
          </label>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded bg-white px-4 py-2 text-sm text-black hover:bg-gray-200 disabled:opacity-50">{saving ? "Saving…" : "Save & start"}</button>
        </div>
      </FocusTrappedDiv>
    </div>
  );
}
