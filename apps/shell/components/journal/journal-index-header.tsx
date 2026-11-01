"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/transition-link";
import { LoadError } from "@/components/load-error";
import { useAuth } from "@/lib/auth-context";
import { fetchInbox } from "@/lib/api/suggestions";
import { getMyJournalAccess, listAccessRequests } from "@/lib/api/journal-access";
import { getTodayInTimezone, resolveViewerTimezone } from "@/lib/timezone";

export function JournalIndexHeader() {
  const { user, loading } = useAuth();
  const [pending, setPending] = useState<number>(0);
  // Owner-only: how many people are waiting for journal access (SHAN-476).
  const [isOwner, setIsOwner] = useState(false);
  const [pendingAccess, setPendingAccess] = useState<number>(0);
  // SHAN-641: these used to fail silently, so a failed inbox load read as "no
  // suggestions waiting", a failed access count as "nobody asked", and a failed
  // role check hid the owner's Access link. A failure now keeps the last counts
  // and says so, and Retry bumps `attempt` to rerun both loads.
  const [inboxFailed, setInboxFailed] = useState(false);
  const [accessFailed, setAccessFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Recompute today whenever the user changes (login/logout or TZ flip in /settings).
  const today = useMemo(() => getTodayInTimezone(resolveViewerTimezone(user)), [user]);

  useEffect(() => {
    if (!user) {
      setInboxFailed(false);
      return;
    }
    let cancelled = false;
    setInboxFailed(false);
    fetchInbox()
      .then((items) => {
        if (!cancelled) setPending(items.length);
      })
      .catch(() => {
        if (!cancelled) setInboxFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, attempt]);

  // The access queue is owner-only, so ask who we are first — listAccessRequests
  // 403s for a plain member and there is no badge to show them anyway.
  useEffect(() => {
    if (!user) {
      setIsOwner(false);
      setPendingAccess(0);
      setAccessFailed(false);
      return;
    }
    let cancelled = false;
    setAccessFailed(false);
    getMyJournalAccess()
      .then((state) => {
        if (cancelled || state.role !== "owner") return;
        setIsOwner(true);
        return listAccessRequests("pending")
          .then((rows) => {
            if (!cancelled) setPendingAccess(rows.length);
          })
          .catch(() => {
            if (!cancelled) setAccessFailed(true);
          });
      })
      .catch(() => {
        // Ownership is unknown, not false: keep whatever we last knew rather
        // than hide the owner's link or show it to a member.
        if (!cancelled) setAccessFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, attempt]);

  if (loading) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/journal/${today}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          <span aria-hidden="true">✏️</span>
          Write today's entry
        </Link>
        {user && (
          <Link
            href="/journal/tea"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/20 px-4 text-sm hover:bg-white/5"
            title="Private, PIN-gated entries — only you see this list"
          >
            <span aria-hidden="true">🍵</span>
            Tea entries
          </Link>
        )}
        {user && (
          <Link
            href="/journal/inbox"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-white/20 px-4 text-sm hover:bg-white/5"
          >
            Inbox
            {pending > 0 && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">
                {pending}
              </span>
            )}
          </Link>
        )}
        {user && (
          <Link
            href="/journal/activity"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-white/20 px-4 text-sm hover:bg-white/5"
            title="Who changed what, including edits made by agents"
          >
            Activity
          </Link>
        )}
        {isOwner && (
          <Link
            href="/journal/access"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-white/20 px-4 text-sm hover:bg-white/5"
            title="Invite members and answer access requests"
          >
            Access
            {pendingAccess > 0 && (
              <span
                className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300"
                aria-label={`${pendingAccess} pending access request${pendingAccess === 1 ? "" : "s"}`}
              >
                {pendingAccess}
              </span>
            )}
          </Link>
        )}
      </div>
      {user && (inboxFailed || accessFailed) && (
        <div className="mt-3">
          <LoadError
            message="Couldn't load your pending counts."
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}
    </div>
  );
}
