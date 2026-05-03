// apps/shell/app/journal/inbox/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchInbox, type InboxItem } from "@/lib/api/suggestions";

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

  if (authLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">
        <p>Sign in to view your inbox.</p>
      </div>
    );
  }
  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">Loading inbox…</div>;
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
              {list.map((item) => (
                <li key={item.suggestion.id} className="hover:bg-white/5">
                  <Link
                    href={`/journal/${date}/suggestions/${item.suggestion.id}`}
                    className="block p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span>
                        by <span className="font-mono">{item.suggestion.proposerId.slice(0, 8)}</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(item.suggestion.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                      {item.suggestion.proposedContent.slice(0, 200).replace(/\s+/g, " ").trim()}
                      {item.suggestion.proposedContent.length > 200 && "…"}
                    </p>
                  </Link>
                </li>
              ))}
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
