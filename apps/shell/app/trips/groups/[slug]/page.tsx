"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { RelativeTime } from "@/lib/format-time";
import {
  getGroupDetail,
  joinGroup,
  postIdea,
  deleteIdea,
  type TripGroupDetail,
  type TripIdea,
} from "@/lib/api/trip-groups";

export default function GroupDetailPage() {
  return (
    <AuthGate>
      <GroupDetail />
    </AuthGate>
  );
}

function GroupDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { user } = useAuth();
  const [detail, setDetail] = useState<TripGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [ideaBody, setIdeaBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const d = await getGroupDetail(slug);
      setDetail(d);
      setForbidden(false);
      setError(null);
    } catch (err) {
      const message = (err as Error).message;
      if (message.toLowerCase().includes("not a member")) {
        setForbidden(true);
        setError(null);
      } else if (message.toLowerCase().includes("not found")) {
        setError("This group doesn't exist.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!slug) return;
    const body = ideaBody.trim();
    if (!body) return;
    setPosting(true);
    setPostError(null);
    try {
      const newIdea: TripIdea = await postIdea(slug, body);
      setDetail((prev) => (prev ? { ...prev, ideas: [newIdea, ...prev.ideas] } : prev));
      setIdeaBody("");
    } catch (err) {
      setPostError((err as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(ideaId: string) {
    if (!slug) return;
    if (!confirm("Delete this idea?")) return;
    try {
      await deleteIdea(slug, ideaId);
      setDetail((prev) =>
        prev ? { ...prev, ideas: prev.ideas.filter((i) => i.id !== ideaId) } : prev,
      );
    } catch (err) {
      setPostError((err as Error).message);
    }
  }

  async function handleJoin() {
    if (!slug) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinGroup(slug);
      await refetch();
    } catch (err) {
      setJoinError((err as Error).message);
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/trips/groups" className="text-sm text-gray-500 hover:text-gray-300">← back to groups</Link>
        <h1 className="mt-3 mb-3 text-2xl font-semibold">Not a member yet</h1>
        <p className="mb-4 text-sm text-gray-400">
          You haven't joined this group. Join to see members and ideas.
        </p>
        {joinError && <p role="alert" className="mb-3 text-sm text-red-400">{joinError}</p>}
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining}
          className="inline-flex min-h-11 items-center justify-center rounded bg-blue-500/90 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {joining ? "Joining…" : `Join "${slug}"`}
        </button>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/trips/groups" className="text-sm text-gray-500 hover:text-gray-300">← back to groups</Link>
        <p role="alert" className="mt-3 text-sm text-red-400">{error ?? "Group not available."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/trips/groups" className="text-sm text-gray-500 hover:text-gray-300">← back to groups</Link>

      <header className="mt-3 mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{detail.title}</h1>
        <p className="mt-1 text-xs text-gray-500">
          Created <RelativeTime iso={detail.createdAt} />
          {" · "}
          {detail.members.length} {detail.members.length === 1 ? "member" : "members"}
          {detail.isOwner && <span className="ml-2 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300">you own this</span>}
        </p>
        <p className="mt-2 font-mono text-[11px] text-gray-600">
          Share this slug: <span className="text-gray-400">{detail.slug}</span>
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-300">Members</h2>
        <ul className="flex flex-wrap gap-2">
          {detail.members.map((m) => (
            <li
              key={m.userId}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-gray-300"
            >
              {m.name ?? "Anonymous"}
              {m.role === "owner" && <span className="ml-1 text-blue-400">·owner</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-300">Post an idea</h2>
        <form onSubmit={handlePost}>
          <textarea
            value={ideaBody}
            onChange={(e) => setIdeaBody(e.target.value)}
            placeholder="What's on your mind? A restaurant, neighborhood, transit tip, vibe…"
            rows={3}
            maxLength={4000}
            className="block w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus:border-white/40 focus:outline-none"
          />
          {postError && <p role="alert" className="mt-2 text-sm text-red-400">{postError}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={!ideaBody.trim() || posting}
              className="inline-flex min-h-9 items-center justify-center rounded bg-white px-3 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-300">Idea inbox</h2>
        {detail.ideas.length === 0 ? (
          <p className="text-sm text-gray-500">No ideas yet. Drop the first one above.</p>
        ) : (
          <ul className="space-y-2">
            {detail.ideas.map((idea) => (
              <li
                key={idea.id}
                className="rounded-md border border-white/10 bg-black/20 p-3"
              >
                <p className="whitespace-pre-wrap text-sm text-white/90">{idea.body}</p>
                <div className="mt-2 flex items-baseline justify-between text-xs text-gray-500">
                  <span>
                    {idea.authorName ?? "Anonymous"}
                    {" · "}
                    <RelativeTime iso={idea.createdAt} />
                  </span>
                  {user?.id === idea.authorId && (
                    <button
                      type="button"
                      onClick={() => handleDelete(idea.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
