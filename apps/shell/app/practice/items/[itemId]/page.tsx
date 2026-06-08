"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { getItemProgress, getSettings, createSessionFromItemIds, type ItemProgressDetail, type PracticeSettings } from "@/lib/api/practice";
import { RelativeTime } from "@/lib/format-time";

function ItemProgressContent({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ItemProgressDetail | null>(null);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getItemProgress(itemId), getSettings()])
      .then(([d, s]) => { setDetail(d); setSettings(s); })
      .catch((e) => setError(e.message));
  }, [itemId]);

  if (error) return <div className="p-6 text-sm text-red-400">{error}</div>;
  if (!detail || !settings) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  const startSingleItem = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const { session } = await createSessionFromItemIds([detail.itemId]);
      router.push(`/practice/sessions/${session.id}`);
    } catch (e) {
      setStartError((e as Error).message ?? "Failed to start session");
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-300">← back</Link>
      <h1 className="mt-3 text-2xl font-semibold">{detail.word}</h1>
      <p className="mt-1 text-sm text-gray-400">
        {detail.prescription.setMode === "time" ? `${detail.prescription.setSize}s per set` : `${detail.prescription.setSize} reps per set`}
        {" · "}{detail.prescription.restSeconds}s rest
      </p>

      <p className="mt-4 text-sm">
        {detail.isSolidified ? (
          <span className="text-emerald-400">✓ Solidified</span>
        ) : (
          <span className="text-gray-300">
            {detail.totalStrikes} strikes · {detail.loadedLocationCount} / {settings.locationsToSolidify} loaded locations
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {detail.lastPracticedAt ? (
          <>Last practiced <RelativeTime iso={detail.lastPracticedAt} /></>
        ) : (
          "Never practiced"
        )}
      </p>

      <h2 className="mt-8 mb-2 text-sm font-medium uppercase tracking-wider text-gray-400">Strikes by location</h2>
      {detail.strikesByLocation.length === 0 ? (
        <p className="text-sm text-gray-500">No strikes yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {detail.strikesByLocation.map((row) => (
            <li key={row.locationId ?? "none"} className="flex items-center justify-between rounded border border-white/10 px-3 py-2">
              <span>{row.locationName ?? "(deleted location)"}</span>
              <span>
                {row.strikeCount} / {settings.strikesPerLoadedLocation} strikes
                {row.isLoaded && <span className="ml-2 text-emerald-400">✓ loaded</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {startError && <p role="alert" className="mt-6 text-sm text-red-400">{startError}</p>}

      <button
        type="button"
        onClick={startSingleItem}
        disabled={starting}
        className="mt-8 rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {starting ? "Starting…" : "Practice this now"}
      </button>
    </div>
  );
}

export default function ItemProgressPage() {
  const params = useParams<{ itemId: string }>();
  return (
    <AuthGate>
      <ItemProgressContent itemId={params.itemId} />
    </AuthGate>
  );
}
