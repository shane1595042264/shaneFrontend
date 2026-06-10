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
  consolidateItinerary,
  type TripGroupDetail,
  type TripIdea,
  type TripItinerary,
} from "@/lib/api/trip-groups";

function InviteLinkBox({ slug }: { slug: string }) {
  const [url, setUrl] = useState(`https://shanejli.com/trips/groups/${slug}`);
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/trips/groups/${slug}`);
  }, [slug]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
    setTimeout(() => setFeedback(null), 2000);
  }

  const srMessage =
    feedback === "copied"
      ? "Invite link copied to clipboard"
      : feedback === "error"
        ? "Failed to copy invite link"
        : "";

  return (
    <div>
      <label htmlFor={`invite-${slug}`} className="block text-[10px] uppercase tracking-wider text-gray-500">
        Invite link
      </label>
      <div className="mt-1 flex items-stretch gap-2">
        <input
          id={`invite-${slug}`}
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-xs text-gray-300 focus:border-white/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded bg-white px-3 text-xs font-medium text-black hover:bg-gray-200"
        >
          Copy
        </button>
      </div>
      {feedback === "copied" && (
        <p className="mt-1 text-xs text-green-400" aria-hidden="true">
          Copied!
        </p>
      )}
      {feedback === "error" && (
        <p className="mt-1 text-xs text-red-400" aria-hidden="true">
          Copy failed — select the link and copy manually.
        </p>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {srMessage}
      </div>
    </div>
  );
}

function ItineraryView({ itinerary }: { itinerary: TripItinerary }) {
  return (
    <div>
      <p className="text-sm text-gray-400">{itinerary.summary}</p>
      <ol className="mt-3 space-y-4">
        {itinerary.days.map((d) => (
          <li key={d.day} className="rounded-md border border-white/10 bg-black/20 p-3">
            <h3 className="text-sm font-medium text-white/90">
              Day {d.day}: {d.title}
              {d.location && <span className="ml-2 text-xs font-normal text-gray-500">{d.location}</span>}
            </h3>
            <ul className="mt-2 space-y-1.5">
              {d.activities.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="w-12 shrink-0 font-mono text-xs leading-5 text-gray-500">
                    {a.time ?? "—"}
                  </span>
                  <span className="text-white/85">
                    {a.title}
                    {a.notes && <span className="ml-1 text-xs text-gray-500">— {a.notes}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

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

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [consolidating, setConsolidating] = useState(false);
  const [consolidateError, setConsolidateError] = useState<string | null>(null);

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
      setDeleteError(null);
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
      setDeleteError(null);
    } catch (err) {
      setDeleteError((err as Error).message);
    }
  }

  async function handleConsolidate() {
    if (!slug) return;
    setConsolidating(true);
    setConsolidateError(null);
    try {
      const { itinerary, itineraryGeneratedAt } = await consolidateItinerary(slug);
      setDetail((prev) => (prev ? { ...prev, itinerary, itineraryGeneratedAt } : prev));
    } catch (err) {
      setConsolidateError((err as Error).message);
    } finally {
      setConsolidating(false);
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

  if (forbidden && slug) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/trips/groups" className="text-sm text-gray-500 hover:text-gray-300">← back to groups</Link>
        <h1 className="mt-3 mb-3 text-2xl font-semibold">Not a member yet</h1>
        <p className="mb-4 text-sm text-gray-400">
          You haven't joined this group. Join to see members and ideas.
        </p>
        <div className="mb-4">
          <InviteLinkBox slug={slug} />
        </div>
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
      </header>

      <section className="mb-8">
        <InviteLinkBox slug={detail.slug} />
      </section>

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
              <span className="ml-1 text-gray-500">
                · joined <RelativeTime iso={m.joinedAt} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-300">
            Itinerary
            {detail.itineraryGeneratedAt && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                generated <RelativeTime iso={detail.itineraryGeneratedAt} />
              </span>
            )}
          </h2>
          {detail.isOwner && (
            <button
              type="button"
              onClick={handleConsolidate}
              disabled={consolidating || detail.ideas.length === 0}
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded bg-blue-500/90 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {consolidating
                ? "Consolidating… (~30s)"
                : detail.itinerary
                  ? "Re-consolidate from ideas"
                  : "Consolidate ideas into itinerary"}
            </button>
          )}
        </div>
        {consolidateError && (
          <p role="alert" className="mb-2 text-sm text-red-400">
            Couldn&apos;t consolidate: {consolidateError}
          </p>
        )}
        {detail.itinerary ? (
          <ItineraryView itinerary={detail.itinerary} />
        ) : (
          <p className="text-sm text-gray-500">
            {detail.isOwner
              ? detail.ideas.length === 0
                ? "No itinerary yet. Post some ideas below, then consolidate."
                : "No itinerary yet. Consolidate the idea inbox to draft one."
              : "No itinerary yet. The group owner can consolidate the idea inbox into one."}
          </p>
        )}
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
        {deleteError && (
          <p role="alert" className="mb-2 text-sm text-red-400">
            Couldn't delete that idea: {deleteError}
          </p>
        )}
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
