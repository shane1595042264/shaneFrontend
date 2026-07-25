"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { RelativeTime } from "@/lib/format-time";
import { getSettings, updateSettings, type PracticeSettings } from "@/lib/api/practice";

const ADMIN_EMAIL = "a1595042264@gmail.com"; // matches ADMIN_EMAILS on Railway

export default function PracticeSettingsPage() {
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [sps, setSps] = useState(5);
  const [spll, setSpll] = useState(5);
  const [lts, setLts] = useState(7);
  const [vl1, setVl1] = useState(1);
  const [vl2, setVl2] = useState(3);
  const [vlapse, setVlapse] = useState(1);
  const [vmem, setVmem] = useState(3);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setSps(s.setsPerStrike);
      setSpll(s.strikesPerLoadedLocation);
      setLts(s.locationsToSolidify);
      setVl1(s.vocabIntervalL1Days);
      setVl2(s.vocabIntervalL2Days);
      setVlapse(s.vocabLapseIntervalDays);
      setVmem(s.vocabLevelToMemorize);
    });
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>;
  if (!user) return <div className="p-6 text-sm">Sign in.</div>;

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="p-6 text-sm text-gray-400">
        Admin-only page. Current settings (read-only):
        {settings && (
          <pre className="mt-2 rounded border border-white/10 bg-black/30 p-3 text-xs">{JSON.stringify(settings, null, 2)}</pre>
        )}
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const updated = await updateSettings({
        setsPerStrike: sps,
        strikesPerLoadedLocation: spll,
        locationsToSolidify: lts,
        vocabIntervalL1Days: vl1,
        vocabIntervalL2Days: vl2,
        vocabLapseIntervalDays: vlapse,
        vocabLevelToMemorize: vmem,
      });
      setSettings(updated);
      setStatus({ kind: "ok", msg: "Saved." });
    } catch (e) {
      setStatus({ kind: "err", msg: (e as Error).message ?? "Failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-300">← back</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold">Practice settings</h1>
      <p className="mb-6 text-sm text-gray-400">These thresholds apply to all users. Changing them retroactively recomputes everyone's progress.</p>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm text-gray-400">Sets per strike</span>
          <input type="number" min={1} max={50} value={sps} onChange={(e) => setSps(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))} className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-400">Strikes per loaded location</span>
          <input type="number" min={1} max={50} value={spll} onChange={(e) => setSpll(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))} className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-400">Loaded locations to solidify</span>
          <input type="number" min={1} max={50} value={lts} onChange={(e) => setLts(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))} className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
      </div>

      <h2 className="mt-10 mb-2 text-lg font-medium">Vocabulary SRS</h2>
      <p className="mb-4 text-sm text-gray-400">Spaced-repetition intervals for the flashcard mode. Days added to a word&apos;s next-review date as it climbs; level to memorize marks a word done at a location.</p>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm text-gray-400">Interval to level 1 (days)</span>
          <input type="number" min={0} max={365} value={vl1} onChange={(e) => setVl1(Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))} className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-400">Interval to level 2 (days)</span>
          <input type="number" min={0} max={365} value={vl2} onChange={(e) => setVl2(Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))} className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-400">Lapse interval — after &ldquo;don&apos;t remember&rdquo; (days)</span>
          <input type="number" min={0} max={365} value={vlapse} onChange={(e) => setVlapse(Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))} className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-400">Level to memorize (1–3)</span>
          <input type="number" min={1} max={3} value={vmem} onChange={(e) => setVmem(Math.max(1, Math.min(3, parseInt(e.target.value, 10) || 1)))} className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm" />
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={save} disabled={saving} className="rounded bg-white px-4 py-2 text-sm text-black hover:bg-gray-200 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </div>

      {status && (
        <p role="status" className={`mt-4 text-sm ${status.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{status.msg}</p>
      )}

      {settings && (
        <p className="mt-6 text-xs text-gray-500">Last updated <RelativeTime iso={settings.updatedAt} />{settings.updatedBy ? ` by ${settings.updatedBy}` : ""}</p>
      )}
    </div>
  );
}
