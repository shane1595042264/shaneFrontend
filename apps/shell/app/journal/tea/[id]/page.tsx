"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntryBody } from "@/components/journal/entry-body";
import {
  deleteTeaEntry,
  getTeaEntry,
  teaEntryWasEdited,
  TeaPinIncorrectError,
  TeaPinRateLimitedError,
  TeaPinRequiredError,
  type TeaEntryResponse,
} from "@/lib/api/tea-entries";

// localStorage key for the last successfully-used PIN per author. Lets a
// viewer who unlocks one entry under Shane's universal PIN (or who reuses
// the same per-entry PIN) skip the gate on subsequent reads of that author's
// entries (SHAN-320). Tied to author so a friend with multiple authors'
// PINs doesn't get them confused.
const lastGoodPinKey = (authorId: string) => `tea-pin-last-good-${authorId}`;

function readCachedPin(authorId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(lastGoodPinKey(authorId));
    return v && /^\d{4}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

function writeCachedPin(authorId: string, pin: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lastGoodPinKey(authorId), pin);
  } catch {
    /* quota or denied — silently ignore; the auto-retry just won't fire next time */
  }
}

function clearCachedPin(authorId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lastGoodPinKey(authorId));
  } catch {
    /* ignore */
  }
}

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
  const [rateLimitedUntilMs, setRateLimitedUntilMs] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  // Author of the locked entry, surfaced from the 401 response. We don't
  // know it before the first request because the URL only carries the entry
  // id, so localStorage auto-retry is staged after the initial 401.
  const [lockedAuthorId, setLockedAuthorId] = useState<string | null>(null);
  const [autoRetryAttempted, setAutoRetryAttempted] = useState(false);

  // First load: try without a PIN. If the viewer is the author, the API
  // returns the full payload (including the PIN). Otherwise the API responds
  // 401 PIN-required (with the author's id) and we either auto-retry with
  // a cached per-author PIN or show the gate.
  //
  // `fromCacheAuthor` carries the authorId for cache-clear on an incorrect
  // cached PIN. Passed in via parameter (not closed over from state) so the
  // callback identity stays stable across renders — otherwise the load+
  // useEffect pair would loop on every state update inside load.
  const load = useCallback(
    async (pin?: string, fromCacheAuthor?: string) => {
      setPinError(null);
      try {
        const r = await getTeaEntry(params.id, pin);
        setData(r);
        setNeedsPin(false);
        setNotFound(false);
        // Successful unlock with a non-empty pin caches it under the
        // author. Author hits (no pin sent) skip this — there's nothing
        // to cache and the author doesn't need their own gate bypass.
        if (pin && !r.isAuthor) {
          writeCachedPin(r.entry.authorId, pin);
        }
      } catch (err) {
        if (err instanceof TeaPinRequiredError) {
          if (err.authorId) setLockedAuthorId(err.authorId);
          setNeedsPin(true);
        } else if (err instanceof TeaPinIncorrectError) {
          setNeedsPin(true);
          if (fromCacheAuthor) {
            // Cached PIN no longer works (universal PIN rotated, per-entry
            // changed). Drop it so we don't keep trying the same dead PIN.
            clearCachedPin(fromCacheAuthor);
            setPinError(null);
          } else {
            setPinError("Incorrect PIN.");
          }
        } else if (err instanceof TeaPinRateLimitedError) {
          setNeedsPin(true);
          setPinInput("");
          setPinError(null);
          setRateLimitedUntilMs(Date.now() + err.retryAfterSec * 1000);
          setRemainingSec(err.retryAfterSec);
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
    setAutoRetryAttempted(false);
    setLockedAuthorId(null);
    load();
  }, [authLoading, load]);

  // After the first request lands on the gate (401 → needsPin + lockedAuthorId
  // populated), try a cached per-author PIN exactly once. A failure here
  // wipes the cache; a success skips the gate entirely.
  useEffect(() => {
    if (!needsPin || autoRetryAttempted || !lockedAuthorId) return;
    const cached = readCachedPin(lockedAuthorId);
    if (!cached) {
      setAutoRetryAttempted(true);
      return;
    }
    setAutoRetryAttempted(true);
    setLoading(true);
    load(cached, lockedAuthorId);
  }, [needsPin, autoRetryAttempted, lockedAuthorId, load]);

  useEffect(() => {
    if (rateLimitedUntilMs === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitedUntilMs - Date.now()) / 1000));
      setRemainingSec(remaining);
      if (remaining === 0) setRateLimitedUntilMs(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [rateLimitedUntilMs]);

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (rateLimitedUntilMs !== null) return;
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
    const isRateLimited = rateLimitedUntilMs !== null && remainingSec > 0;
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Link href="/journal" className="text-sm text-gray-500 hover:text-gray-300">← back to journal</Link>
        <h1 className="mt-4 flex items-center gap-2 text-xl font-semibold">
          <span aria-hidden>🍵</span> Tea entry — locked
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Enter the 4-digit PIN to read. Once unlocked, you won&apos;t be
          re-prompted for other entries by the same author.
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
            disabled={isRateLimited}
            className="w-32 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-base tracking-[0.4em] text-white focus:border-white/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="4-digit PIN"
          />
          <button
            type="submit"
            disabled={pinInput.length !== 4 || isRateLimited}
            className="inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Unlock
          </button>
        </form>
        {isRateLimited ? (
          <p className="mt-3 text-sm text-amber-400" role="status" aria-live="polite">
            Too many incorrect PINs. Try again in {remainingSec}s.
          </p>
        ) : (
          pinError && <p className="mt-3 text-sm text-red-400">{pinError}</p>
        )}
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
          {teaEntryWasEdited(e) && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 align-middle text-[10px] font-medium text-gray-400">
              edited
            </span>
          )}
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          {new Date(e.createdAt).toLocaleString()}
          {teaEntryWasEdited(e) && (
            <>
              <span aria-hidden> · </span>
              <span>edited {new Date(e.updatedAt).toLocaleString()}</span>
            </>
          )}
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
