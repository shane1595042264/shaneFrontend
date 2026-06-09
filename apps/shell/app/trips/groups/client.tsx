"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { RelativeTime } from "@/lib/format-time";
import {
  listMyGroups,
  joinGroup,
  type TripGroupSummary,
} from "@/lib/api/trip-groups";

export default function GroupsIndexClient() {
  return (
    <AuthGate>
      <GroupsIndex />
    </AuthGate>
  );
}

function GroupsIndex() {
  const router = useRouter();
  const [groups, setGroups] = useState<TripGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinSlug, setJoinSlug] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    listMyGroups()
      .then((g) => {
        setGroups(g);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const slug = joinSlug.trim().toLowerCase();
    if (!slug) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinGroup(slug);
      router.push(`/trips/groups/${result.group.slug}`);
    } catch (err) {
      setJoinError((err as Error).message);
      setJoining(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/trips" className="text-sm text-gray-500 hover:text-gray-300">← back to trips</Link>
      <header className="mt-3 mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Trip Planning Groups</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Collect trip ideas from your group, async. Drop fragments as they come; consolidate later.
          </p>
        </div>
        <Link
          href="/trips/groups/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          <span aria-hidden="true">＋</span>
          New group
        </Link>
      </header>

      <section className="mb-10 rounded-md border border-white/10 bg-black/20 p-4">
        <h2 className="mb-2 text-sm font-medium text-gray-300">Join an existing group</h2>
        <form onSubmit={handleJoin} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={joinSlug}
            onChange={(e) => setJoinSlug(e.target.value)}
            placeholder="group-slug (e.g. tokyo-2026)"
            maxLength={80}
            className="block min-h-11 flex-1 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/90 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!joinSlug.trim() || joining}
            className="inline-flex min-h-11 items-center justify-center rounded bg-blue-500/90 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
        {joinError && <p role="alert" className="mt-2 text-sm text-red-400">{joinError}</p>}
      </section>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-400">{error}</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No groups yet. <Link href="/trips/groups/new" className="underline">Create your first one</Link> or join with a slug above.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/trips/groups/${g.slug}`}
                className="block rounded-md border border-white/10 bg-black/20 p-4 transition-colors hover:bg-black/30"
              >
                <h2 className="font-medium text-white">{g.title}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  <RelativeTime iso={g.createdAt} />
                  {" · "}
                  {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                  {" · "}
                  {g.ideaCount} {g.ideaCount === 1 ? "idea" : "ideas"}
                  {g.isOwner && <span className="ml-2 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300">owner</span>}
                </p>
                <p className="mt-2 font-mono text-[11px] text-gray-600">/trips/groups/{g.slug}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
