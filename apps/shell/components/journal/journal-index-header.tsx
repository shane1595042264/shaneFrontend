"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchInbox } from "@/lib/api/suggestions";
import { LoginButton } from "@/components/login-button";
import { getTodayInTimezone, resolveViewerTimezone } from "@/lib/timezone";

export function JournalIndexHeader() {
  const { user, loading } = useAuth();
  const [pending, setPending] = useState<number>(0);
  // Recompute today whenever the user changes (login/logout or TZ flip in /settings).
  const today = useMemo(() => getTodayInTimezone(resolveViewerTimezone(user)), [user]);

  useEffect(() => {
    if (!user) return;
    fetchInbox()
      .then((items) => setPending(items.length))
      .catch(() => setPending(0));
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
      <a
        href="/journal/feed.xml"
        target="_blank"
        rel="noopener"
        aria-label="Subscribe via RSS"
        title="Subscribe via RSS"
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-white/20 px-4 text-sm hover:bg-white/5"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="currentColor"
        >
          <path d="M4 11a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6v-3zm0-7a16 16 0 0 1 16 16h-3A13 13 0 0 0 4 7V4zm2.5 13a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
        </svg>
        RSS
      </a>
      {!user && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-500">
            Sign in to claim a date or suggest edits.
          </span>
          <LoginButton />
        </div>
      )}
    </div>
  );
}
