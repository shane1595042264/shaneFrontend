"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { listPracticeableItems, type PracticeableItem } from "@/lib/api/practice";
import { LoginButton } from "@/components/login-button";

export default function PracticeIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PracticeableItem[] | null>(null);
  const [includeSolidified, setIncludeSolidified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listPracticeableItems(null, includeSolidified)
      .then(setItems)
      .catch((e) => setError(e.message ?? "Failed to load"));
  }, [user, includeSolidified]);

  if (authLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-sm text-gray-400">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-semibold">Practice</h1>
        <p className="mt-4 mb-3 text-sm text-gray-400">Sign in to start practicing.</p>
        <LoginButton />
      </div>
    );
  }

  const totalStrikes = items?.reduce((sum, i) => sum + i.totalStrikes, 0) ?? 0;
  const solidifiedCount = items?.filter((i) => i.isSolidified).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Practice</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {items === null
              ? "Loading…"
              : `${items.length} practice-able · ${solidifiedCount} solidified · ${totalStrikes} strikes total`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/practice/history"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-sm hover:bg-white/5"
          >
            History
          </Link>
          <Link
            href="/practice/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
          >
            ✏️ New session
          </Link>
        </div>
      </header>

      <label className="mb-4 flex items-center gap-2 text-sm text-gray-400">
        <input
          type="checkbox"
          checked={includeSolidified}
          onChange={(e) => setIncludeSolidified(e.target.checked)}
        />
        Show solidified
      </label>

      {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}

      {items === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">
          No practice-able items yet. <Link href="/knowledge" className="underline">Configure an item</Link>.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <li key={it.itemId}>
              <Link
                href={`/practice/items/${it.itemId}`}
                className="block rounded-md border border-white/10 bg-black/20 p-4 hover:bg-black/30"
              >
                <h2 className="font-medium text-white">{it.word}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {it.category} · {it.prescription.setMode === "time" ? `${it.prescription.setSize}s` : `${it.prescription.setSize} reps`} per set
                </p>
                <p className="mt-2 text-xs">
                  {it.isSolidified ? (
                    <span className="text-emerald-400">✓ Solidified</span>
                  ) : (
                    <span className="text-gray-400">
                      {it.totalStrikes} strikes · {it.loadedLocations} loaded location{it.loadedLocations === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
