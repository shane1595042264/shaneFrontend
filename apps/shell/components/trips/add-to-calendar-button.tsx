"use client";

import { useEffect, useState } from "react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import {
  getCalendarStatus,
  connectCalendar,
  exportToCalendar,
} from "@/lib/api/trip-groups";

/**
 * "Add itinerary to Google Calendar" (SHAN-278).
 *
 * Uses the WordByWord OAuth client (id comes from the backend status
 * endpoint) in GIS auth-code popup mode — separate from the login
 * provider, hence the nested GoogleOAuthProvider. Connected users export
 * directly; everyone else gets the consent popup first, then the export
 * runs automatically.
 */
export function AddToCalendarButton({ slug }: { slug: string }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getCalendarStatus()
      .then((s) => {
        setClientId(s.clientId || null);
        setConnected(s.connected);
      })
      .catch(() => setClientId(null));
  }, []);

  if (!clientId) return null;

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ExportFlow slug={slug} connected={connected} setConnected={setConnected} />
    </GoogleOAuthProvider>
  );
}

function ExportFlow({
  slug,
  connected,
  setConnected,
}: {
  slug: string;
  connected: boolean;
  setConnected: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { created, deletedPrevious, skippedDays } = await exportToCalendar(slug);
      setMessage(
        `Added ${created} event${created === 1 ? "" : "s"} to your Google Calendar` +
          (deletedPrevious > 0 ? ` (replaced ${deletedPrevious} from the previous export)` : "") +
          (skippedDays.length > 0 ? `. Days without dates were skipped: ${skippedDays.join(", ")}.` : "."),
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "calendar_not_connected") {
        // Token gone (revoked or never granted) — fall back to consent.
        setConnected(false);
        connect();
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const connect = useGoogleLogin({
    flow: "auth-code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    onSuccess: async ({ code }) => {
      setBusy(true);
      setError(null);
      try {
        await connectCalendar(code);
        setConnected(true);
        await runExport();
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
    },
    onError: () => setError("Google authorization was cancelled or failed."),
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => (connected ? runExport() : connect())}
        disabled={busy}
        className="inline-flex min-h-8 items-center rounded border border-white/20 px-2.5 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
      >
        {busy
          ? "Working…"
          : connected
            ? "Add itinerary to Google Calendar"
            : "Connect Google Calendar & add itinerary"}
      </button>
      {message && (
        <p role="status" className="mt-1.5 text-xs text-green-400">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
