"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearUniversalTeaPin,
  getUniversalTeaPinState,
  setUniversalTeaPin,
} from "@/lib/api/user-prefs";

interface Props {
  className?: string;
}

// Author-only settings card on /journal/tea. Lets the author configure a
// single 4-digit PIN that unlocks every one of their tea entries (SHAN-320).
// The actual PIN value is never returned by the API on read — only "isSet" —
// so the input always starts blank and the reveal toggle only exposes what
// the author typed in this session.
export function UniversalTeaPinCard({ className = "" }: Props) {
  const [loading, setLoading] = useState(true);
  const [isSet, setIsSet] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  // SHAN-630: a failed status load left isSet false, so the card said "Not
  // set" (and hid Clear) for an author who has a PIN. Until a load or a save
  // tells us, the status is unknown.
  const [statusUnknown, setStatusUnknown] = useState(false);
  const mounted = useRef(true);

  const loadStatus = useCallback(() => {
    setLoading(true);
    setError(null);
    getUniversalTeaPinState()
      .then((s) => {
        if (!mounted.current) return;
        setIsSet(s.isSet);
        setStatusUnknown(false);
      })
      .catch(() => {
        if (!mounted.current) return;
        setStatusUnknown(true);
        setError("Could not load universal PIN status.");
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadStatus();
    return () => {
      mounted.current = false;
    };
  }, [loadStatus]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be 4 digits.");
      return;
    }
    setError(null);
    setSavedNote(null);
    setSaving(true);
    try {
      const s = await setUniversalTeaPin(pin);
      setIsSet(s.isSet);
      setStatusUnknown(false);
      setPin("");
      setShowPin(false);
      setSavedNote("Universal PIN saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save PIN.");
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    if (!confirm("Clear the universal PIN? Viewers will need each entry's per-entry PIN again.")) return;
    setError(null);
    setSavedNote(null);
    setSaving(true);
    try {
      const s = await clearUniversalTeaPin();
      setIsSet(s.isSet);
      setStatusUnknown(false);
      setPin("");
      setShowPin(false);
      setSavedNote("Universal PIN cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear PIN.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={`rounded-md border border-white/10 bg-white/[0.03] p-4 ${className}`}
      aria-label="Universal tea PIN settings"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-white">Universal tea PIN</h2>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            isSet ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-gray-400"
          }`}
        >
          {loading ? "…" : statusUnknown ? "Unknown" : isSet ? "Set" : "Not set"}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Unlocks every one of your tea entries for anyone who enters it. Set
        this once and share it with a trusted friend so they don&apos;t have to
        retype a different PIN on every post.
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="universal-tea-pin-input">
          New universal PIN
        </label>
        <input
          id="universal-tea-pin-input"
          type={showPin ? "text" : "password"}
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setSavedNote(null);
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
          }}
          placeholder="••••"
          disabled={loading || saving}
          className="w-28 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-base tracking-[0.4em] text-white focus:border-white/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="New universal PIN (4 digits)"
        />
        <button
          type="button"
          onClick={() => setShowPin((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200"
          aria-pressed={showPin}
        >
          {showPin ? "Hide" : "Reveal"}
        </button>
        <button
          type="submit"
          disabled={loading || saving || pin.length !== 4}
          className="ml-auto inline-flex min-h-10 items-center justify-center rounded bg-white px-3 text-xs font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : statusUnknown ? "Save PIN" : isSet ? "Replace PIN" : "Set PIN"}
        </button>
        {isSet && (
          <button
            type="button"
            onClick={onClear}
            disabled={loading || saving}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
          {statusUnknown && !loading && (
            <>
              {" "}
              <button
                type="button"
                onClick={loadStatus}
                className="text-gray-200 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white"
              >
                Retry
              </button>
            </>
          )}
        </p>
      )}
      {savedNote && !error && (
        <p className="mt-2 text-xs text-emerald-400" role="status" aria-live="polite">
          {savedNote}
        </p>
      )}
    </section>
  );
}
