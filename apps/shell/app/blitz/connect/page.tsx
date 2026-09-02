"use client";

import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  BLITZ_ORIGIN,
  BLITZ_SESSION_MESSAGE_TYPE,
  createSyncSession,
  type BlitzSyncSession,
} from "@/lib/api/blitz";

type Phase = "working" | "handed-off" | "manual" | "error";

function ConnectBody() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("working");
  const [session, setSession] = useState<BlitzSyncSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    createSyncSession()
      .then((s) => {
        setSession(s);
        // Only the window that opened us (the Blitz app) ever receives the
        // session, and only if it lives on the Blitz origin; any other visitor
        // gets the manual view instead.
        const opener = window.opener as Window | null;
        if (opener && !opener.closed) {
          opener.postMessage({ type: BLITZ_SESSION_MESSAGE_TYPE, version: 1, ...s }, BLITZ_ORIGIN);
          setPhase("handed-off");
          window.setTimeout(() => window.close(), 1200);
        } else {
          setPhase("manual");
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not create a sync session");
        setPhase("error");
      });
  }, [user]);

  if (phase === "working") {
    return (
      <p className="text-gray-400 text-sm" role="status">
        Connecting your Google account to Blitz…
      </p>
    );
  }
  if (phase === "handed-off") {
    return (
      <div className="space-y-2" role="status">
        <h1 className="text-2xl font-bold">Connected</h1>
        <p className="text-gray-400 text-sm">
          Blitz is now syncing as {session?.email}. This window will close by itself.
        </p>
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="space-y-2" role="alert">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Connect Blitz</h1>
      <p className="text-gray-400 text-sm">
        Open this page from Blitz (Settings → Sync → Sign in with Google) and it connects
        automatically. If you got here another way, these values go into the SuperSync settings of
        Blitz on this device.
      </p>
      <dl className="space-y-3 text-sm">
        <ManualField label="Server URL" value={session?.baseUrl ?? ""} />
        <ManualField label="Access token" value={session?.accessToken ?? ""} secret />
        <ManualField label="Encryption password" value={session?.encryptKey ?? ""} secret />
      </dl>
      <p className="text-gray-500 text-xs">
        Treat the token and password like a password: together they unlock your tasks.
      </p>
    </div>
  );
}

function ManualField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  return (
    <div className="rounded-lg border border-white/10 p-3">
      <dt className="text-gray-400 mb-1 flex items-center justify-between">
        <span>{label}</span>
        <span className="flex gap-2">
          {secret && (
            <button
              type="button"
              onClick={() => setShown((v) => !v)}
              className="text-xs text-gray-300 hover:text-white"
            >
              {shown ? "Hide" : "Show"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="text-xs text-gray-300 hover:text-white"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </dt>
      <dd className="font-mono break-all text-gray-200">
        {shown ? value : "•".repeat(Math.min(value.length, 32))}
      </dd>
    </div>
  );
}

export default function BlitzConnectPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <AuthGate>
        <ConnectBody />
      </AuthGate>
    </div>
  );
}
