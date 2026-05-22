// apps/shell/app/journal/inbox/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchInbox, type InboxItem } from "@/lib/api/suggestions";
import { RelativeTime } from "@/lib/format-time";

export default function InboxPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchInbox()
      .then(setItems)
      .catch((e) => setError(e.message ?? "Failed to load inbox"))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || (user && loading)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8" aria-busy={true}>
        <div className="mb-2 h-7 w-24 rounded bg-white/8 animate-pulse" />
        <div className="mb-6 h-3 w-72 rounded bg-white/8 animate-pulse" />
        <div role="status" aria-label="Loading inbox" className="space-y-6">
          <span className="sr-only">Loading inbox…</span>
          {Array.from({ length: 2 }).map((_, sectionIdx) => (
            <section key={sectionIdx}>
              <div className="mb-2 h-4 w-28 rounded bg-white/8 animate-pulse" />
              <ul className="divide-y divide-white/10 rounded-md border border-white/10">
                {Array.from({ length: 2 }).map((_, rowIdx) => (
                  <li key={rowIdx} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-white/8 animate-pulse" />
                        <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
                      </div>
                      <div className="h-3 w-12 rounded bg-white/8 animate-pulse" />
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <div className="h-3 w-11/12 rounded bg-white/8 animate-pulse" />
                      <div className="h-3 w-3/4 rounded bg-white/8 animate-pulse" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">
        <p>Sign in to view your inbox.</p>
      </div>
    );
  }
  if (error) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-red-400">{error}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-gray-400">No pending suggestions on your entries.</p>
        <Link href="/journal" className="mt-3 inline-block text-sm text-gray-500 hover:text-gray-300">
          ← all entries
        </Link>
      </div>
    );
  }

  // Group by entry date for legibility when one entry has multiple pending suggestions
  const byDate = new Map<string, InboxItem[]>();
  for (const item of items) {
    const list = byDate.get(item.entry.date) ?? [];
    list.push(item);
    byDate.set(item.entry.date, list);
  }
  const grouped = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Inbox</h1>
      <p className="mb-6 text-sm text-gray-400">
        {items.length} pending suggestion{items.length === 1 ? "" : "s"} across {grouped.length} entr{grouped.length === 1 ? "y" : "ies"}.
      </p>

      <div className="space-y-6">
        {grouped.map(([date, list]) => (
          <section key={date}>
            <header className="mb-2 flex items-baseline justify-between">
              <h2 className="font-mono text-sm">{date}</h2>
              <Link
                href={`/journal/${date}/suggestions`}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                view all suggestions →
              </Link>
            </header>
            <ul className="divide-y divide-white/10 rounded-md border border-white/10">
              {list.map((item) => {
                const proposerName = item.suggestion.proposer?.name?.trim() || "Anonymous";
                const proposerAvatar = item.suggestion.proposer?.avatarUrl;
                return (
                <li key={item.suggestion.id} className="hover:bg-white/5">
                  <Link
                    href={`/journal/${date}/suggestions/${item.suggestion.id}`}
                    className="block p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        {proposerAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={proposerAvatar}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <span className="text-gray-300">{proposerName}</span>
                      </span>
                      <RelativeTime iso={item.suggestion.createdAt} className="text-xs text-gray-500" />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                      {item.suggestion.proposedContent.slice(0, 200).replace(/\s+/g, " ").trim()}
                      {item.suggestion.proposedContent.length > 200 && "…"}
                    </p>
                  </Link>
                </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <Link href="/journal" className="mt-8 inline-block text-sm text-gray-500 hover:text-gray-300">
        ← all entries
      </Link>
    </div>
  );
}
