"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { LoginButton } from "@/components/login-button";
import {
  getMyJournalAccess,
  requestJournalAccess,
  type JournalAccessState,
} from "@/lib/api/journal-access";

/**
 * Google-Docs-style access gate for the journal (SHAN-475, Phase 2 of SHAN-472).
 *
 * The journal is invite-only: the backend 403s every read for a non-member, so
 * children here are the *only* place entry content is ever rendered, and they
 * load it client-side with the viewer's JWT. Nothing private reaches the
 * publicly-cached ISR document.
 *
 * The check has to live in an effect rather than a Server Component: the JWT is
 * in localStorage, so an SSR fetch would send no Authorization header and always
 * read back "signed out".
 */
export function JournalAccessGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<JournalAccessState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Re-run when the signed-in user changes: signing in from the gate itself has
  // to flip a "you need access" screen into the entry (or into the request form).
  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    setLoadError(false);
    getMyJournalAccess({ signal: controller.signal })
      .then(setState)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, [authLoading, user?.id]);

  const submitRequest = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { status } = await requestJournalAccess(message.trim() || undefined);
      setState((prev) => ({
        role: prev?.role ?? null,
        requestStatus: status,
        requestMessage: message.trim() || null,
      }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't send your request");
    } finally {
      setSubmitting(false);
    }
  }, [message]);

  if (authLoading || (!state && !loadError)) {
    return (
      <div className="flex items-center justify-center py-32">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white"
          role="status"
          aria-label="Checking journal access"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <Shell title="Couldn't check your access">
        <p className="text-sm text-gray-400">
          The server didn&apos;t answer. Reload the page to try again.
        </p>
      </Shell>
    );
  }

  if (state?.role) return <>{children}</>;

  if (!user) {
    return (
      <Shell title="You need access">
        <p className="text-sm text-gray-400">
          This journal is private. Sign in with Google to ask Shane for access.
        </p>
        <div className="mt-6 flex justify-center">
          <LoginButton />
        </div>
      </Shell>
    );
  }

  if (state?.requestStatus === "pending") {
    return (
      <Shell title="Access request sent">
        <p className="text-sm text-gray-400">
          Shane has been asked to let{" "}
          <span className="text-gray-200">{user.email}</span> in. You&apos;ll see the
          journal here as soon as the request is approved.
        </p>
      </Shell>
    );
  }

  if (state?.requestStatus === "rejected") {
    return (
      <Shell title="Access declined">
        <p className="text-sm text-gray-400">
          Your request for <span className="text-gray-200">{user.email}</span> wasn&apos;t
          approved. Reach out to Shane directly if you think that was a mistake.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="You need access">
      <p className="text-sm text-gray-400">
        This journal is private. Ask Shane for access, or switch to an account that
        already has it. You&apos;re signed in as{" "}
        <span className="text-gray-200">{user.email}</span>.
      </p>
      <label htmlFor="journal-access-message" className="mt-6 block text-xs text-gray-400">
        Message (optional)
      </label>
      <textarea
        id="journal-access-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Tell Shane who you are…"
        className="mt-1.5 block w-full resize-y rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm placeholder:text-gray-500 focus:border-white/40 focus:outline-none"
      />
      {submitError && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {submitError}
        </p>
      )}
      <button
        type="button"
        onClick={() => void submitRequest()}
        disabled={submitting}
        className="mt-4 inline-flex min-h-9 items-center rounded-md border border-white/15 bg-white/5 px-4 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Request access"}
      </button>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center sm:text-left">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-3">{children}</div>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-gray-400 transition-colors hover:text-gray-200"
        >
          &larr; Back to the periodic table
        </Link>
      </div>
    </div>
  );
}
