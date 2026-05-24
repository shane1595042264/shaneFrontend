"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { updateMyTimezone } from "@/lib/auth-api";
import { DEFAULT_TIMEZONE, getTodayInTimezone } from "@/lib/timezone";

function listIanaTimezones(): string[] {
  // Intl.supportedValuesOf is available in modern browsers and Node 18+.
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === "function") {
    try {
      return intl.supportedValuesOf("timeZone");
    } catch {
      // fall through to the hand-curated short list
    }
  }
  return [
    "America/Chicago",
    "America/Los_Angeles",
    "America/Denver",
    "America/New_York",
    "America/Anchorage",
    "America/Honolulu",
    "America/Phoenix",
    "America/Toronto",
    "America/Mexico_City",
    "America/Sao_Paulo",
    "America/Argentina/Buenos_Aires",
    "Europe/London",
    "Europe/Dublin",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Amsterdam",
    "Europe/Stockholm",
    "Europe/Moscow",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Bangkok",
    "Asia/Singapore",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Australia/Sydney",
    "Australia/Perth",
    "Pacific/Auckland",
    "UTC",
  ];
}

export function TimezoneSection() {
  const { user, patchUser } = useAuth();
  const zones = useMemo(listIanaTimezones, []);
  const [value, setValue] = useState<string>(user?.timezone ?? DEFAULT_TIMEZONE);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    if (user?.timezone && user.timezone !== value) {
      setValue(user.timezone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.timezone]);

  if (!user) {
    return (
      <p className="text-sm text-gray-500">Sign in to set your timezone.</p>
    );
  }

  const dirty = value !== (user.timezone ?? DEFAULT_TIMEZONE);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await updateMyTimezone(value);
      patchUser({ timezone: res.timezone });
      setStatus({ kind: "ok", msg: `Saved — today is ${getTodayInTimezone(res.timezone)} in ${res.timezone}.` });
    } catch (err: any) {
      setStatus({ kind: "err", msg: err?.message ?? "Failed to save timezone" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-10">
      <header className="mb-3">
        <h2 className="text-lg font-medium">Time zone</h2>
        <p className="mt-1 text-xs text-gray-500">
          Drives what counts as &ldquo;today&rdquo; on the journal and tags your posts so viewers in other zones aren&apos;t confused.
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="tz-select" className="sr-only">Time zone</label>
        <select
          id="tz-select"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving}
          className="min-h-11 min-w-[16rem] rounded border border-white/15 bg-black/30 px-3 py-1.5 font-mono text-sm text-white/90 focus:border-white/40 focus:outline-none"
        >
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <span className="text-xs text-gray-500">
          Currently {getTodayInTimezone(value)} in <span className="font-mono">{value}</span>
        </span>
      </div>
      {status && (
        <p
          role="status"
          className={`mt-3 text-sm ${status.kind === "ok" ? "text-green-400" : "text-red-400"}`}
        >
          {status.msg}
        </p>
      )}
    </section>
  );
}
