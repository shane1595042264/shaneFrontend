"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntryBody } from "@/components/journal/entry-body";
import {
  deleteTeaEntry,
  getTeaEntry,
  TeaPinIncorrectError,
  TeaPinRequiredError,
  type TeaEntryResponse,
} from "@/lib/api/tea-entries";

export default function TeaEntryReadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [data, setData] = useState<TeaEntryResponse | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  // First load: try without a PIN. If the viewer is the author, the API
  // returns the full payload (including the PIN). Otherwise the API responds
  // 401 PIN-required and we show the gate.
  const load = useCallback(
    async (pin?: string) => {
      setPinError(null);
      try {
        const r = await getTeaEntry(params.id, pin);
        setData(r);
        setNeedsPin(false);
        setNotFound(false);
      } catch (err) {
        if (err instanceof TeaPinRequiredError) {
          setNeedsPin(true);
        } else if (err instanceof TeaPinIncorrectError) {
          setNeedsPin(true);
          setPinError("Incorrect PIN.");
        } else if (err instanceof Error && err.message === "TEA_NOT_FOUND") {
          setNotFound(true);
        } else {
          setPinError("Could not load entry.");
        }
      } finally {
        setLoading(false);
      }
    },
    [params.id],
  );

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    load();
  }, [authLoading, load]);

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("PIN must be 4 digits.");
      return;
    }
    setLoading(true);
    load(pinInput);
  };

  const onDelete = async () => {
    if (!data) return;
    if (!confirm("Delete this tea entry? This can't be undone.")) return;
    setBusy(true);
    try {
      await deleteTeaEntry(data.entry.id);
      router.push("/journal/tea");
    } catch {
      setBusy(false);
      alert("Failed to delete.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12" aria-busy>
        <div className="h-3 w-28 rounded bg-white/8 animate-pulse" />
        <div className="mt-3 h-7 w-44 rounded bg-white/8 animate-pulse" />
        <div className="mt-6 h-40 w-full rounded border border-white/10 bg-white/8 animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">
        <Link href="/journal" className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">This tea entry doesn&apos;t exist.</p>
      </div>
    );
  }

  if (needsPin) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Link href="/journal" className="text-sm text-gray-500 hover:text-gray-300">← back to journal</Link>
        <h1 className="mt-4 flex items-center gap-2 text-xl font-semibold">
          <span aria-hidden>🍵</span> Tea entry — locked
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Enter the 4-digit PIN to read.
        </p>
        <form onSubmit={submitPin} className="mt-6 flex items-center gap-2">
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="w-32 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-base tracking-[0.4em] text-white focus:border-white/30 focus:outline-none"
            aria-label="4-digit PIN"
          />
          <button
            type="submit"
            disabled={pinInput.length !== 4}
            className="inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Unlock
          </button>
        </form>
        {pinError && <p className="mt-3 text-sm text-red-400">{pinError}</p>}
      </div>
    );
  }

  if (!data) return null;

  const e = data.entry;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={data.isAuthor ? "/journal/tea" : "/journal"} className="text-sm text-gray-500 hover:text-gray-300">
        ← back
      </Link>
      <header className="mt-4 mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span aria-hidden>🍵</span>
          {e.title?.trim() || "Tea entry"}
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          {new Date(e.createdAt).toLocaleString()}
        </p>

        {data.isAuthor && e.pin && (
          <div className="mt-4 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
            <span className="text-gray-500">PIN</span>
            <span className="font-mono text-base tracking-[0.4em] text-white">
              {showPin ? e.pin : "••••"}
            </span>
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="ml-auto text-xs text-gray-400 hover:text-gray-200"
              aria-pressed={showPin}
            >
              {showPin ? "Hide" : "Reveal"}
            </button>
          </div>
        )}
      </header>

      <EntryBody content={e.content} />

      {data.isAuthor && (
        <div className="mt-10 flex items-center gap-4 border-t border-white/10 pt-6">
          <Link
            href={`/journal/tea/${data.entry.id}/edit`}
            className="text-sm text-gray-300 hover:text-white"
          >
            Edit
          </Link>
          <button
            onClick={onDelete}
            disabled={busy}
            className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete tea entry"}
          </button>
        </div>
      )}
    </div>
  );
}
