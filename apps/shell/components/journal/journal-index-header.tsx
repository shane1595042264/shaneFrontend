"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  // Recompute today whenever the user changes (login/logout or TZ flip in /settings).
  const today = useMemo(() => getTodayInTimezone(resolveViewerTimezone(user)), [user]);

  useEffect(() => {
    if (!user) return;
    fetchInbox()
      .then((items) => setPending(items.length))
      .catch(() => setPending(0));
  }, [user]);

  // The access queue is owner-only, so ask who we are first — listAccessRequests
  // 403s for a plain member and there is no badge to show them anyway.
  useEffect(() => {
    if (!user) {
      setIsOwner(false);
      setPendingAccess(0);
      return;
    }
    let cancelled = false;
    getMyJournalAccess()
      .then((state) => {
        if (cancelled || state.role !== "owner") return;
        setIsOwner(true);
        return listAccessRequests("pending")
          .then((rows) => {
            if (!cancelled) setPendingAccess(rows.length);
          })
          .catch(() => {
            if (!cancelled) setPendingAccess(0);
          });
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return null;
  }

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
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
  );
}
