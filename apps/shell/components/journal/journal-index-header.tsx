"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchInbox } from "@/lib/api/suggestions";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JournalIndexHeader() {
  const { user, loading } = useAuth();
  const [pending, setPending] = useState<number>(0);
  const today = todayUtc();

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
        className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-200"
      >
        <span aria-hidden="true">✏️</span>
        Write today's entry
      </Link>
      {user && (
        <Link
          href="/journal/inbox"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
        >
          Inbox
          {pending > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">
              {pending}
            </span>
          )}
        </Link>
      )}
      {!user && (
        <span className="text-sm text-gray-500">
          Sign in to claim a date or suggest edits.
        </span>
      )}
    </div>
  );
}
