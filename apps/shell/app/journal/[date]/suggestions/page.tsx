"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { listSuggestions, type Suggestion } from "@/lib/api/suggestions";
import { RelativeTime } from "@/lib/format-time";

const STATUS_FILTERS = ["pending", "approved", "rejected", "withdrawn"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function SuggestionsListPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const router = useRouter();
  const searchParams = useSearchParams();
  const submittedId = searchParams.get("submitted");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [showSubmittedBanner, setShowSubmittedBanner] = useState(false);

  useEffect(() => {
    setShowSubmittedBanner(Boolean(submittedId));
  }, [submittedId]);

  useEffect(() => {
    setLoading(true);
    listSuggestions(date, filter)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [date, filter]);

  const dismissBanner = () => {
    setShowSubmittedBanner(false);
    router.replace(`/journal/${date}/suggestions`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/journal/${date}`} className="text-sm text-gray-500 hover:text-gray-300">
        ← back to entry
      </Link>
      <h1 className="mt-3 mb-4 font-mono text-2xl">{date} — suggestions</h1>

      {showSubmittedBanner && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
        >
          <span>Your suggestion was submitted — the author will review it.</span>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="text-emerald-300/70 hover:text-emerald-100"
          >
            ×
          </button>
        </div>
      )}

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
          {items.map((s) => {
            const proposerName = s.proposer?.name?.trim() || "Anonymous";
            const proposerAvatar = s.proposer?.avatarUrl;
            return (
            <li
              key={s.id}
              className={`hover:bg-white/5 ${
                s.id === submittedId ? "ring-1 ring-inset ring-emerald-500/40 bg-emerald-500/[0.04]" : ""
              }`}
            >
              <Link href={`/journal/${date}/suggestions/${s.id}`} className="block p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
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
                    <RelativeTime iso={s.createdAt} className="text-xs text-gray-500" />
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
