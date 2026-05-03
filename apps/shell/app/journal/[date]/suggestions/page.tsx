"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { listSuggestions, type Suggestion } from "@/lib/api/suggestions";

const STATUS_FILTERS = ["pending", "approved", "rejected", "withdrawn"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function SuggestionsListPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const [items, setItems] = useState<Suggestion[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listSuggestions(date, filter)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [date, filter]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/journal/${date}`} className="text-sm text-gray-500 hover:text-gray-300">
        ← back to entry
      </Link>
      <h1 className="mt-3 mb-4 font-mono text-2xl">{date} — suggestions</h1>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded border px-2 py-1 ${
              filter === s
                ? "border-white bg-white text-black"
                : "border-white/20 hover:bg-white/5"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">No {filter} suggestions.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {items.map((s) => (
            <li key={s.id} className="hover:bg-white/5">
              <Link href={`/journal/${date}/suggestions/${s.id}`} className="block p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm">
                    by <span className="font-mono">{s.proposerId.slice(0, 8)}</span>
                    <span className="ml-2 text-gray-500">
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      s.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : s.status === "rejected"
                        ? "bg-red-500/15 text-red-300"
                        : s.status === "withdrawn"
                        ? "bg-gray-500/15 text-gray-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
