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
  listSuggestions,
  approveSuggestion,
  rejectSuggestion,
  listPhotos,
  uploadPhoto,
  deletePhoto,
  unsplashFill,
  updateItinerary,
  type TripGroupDetail,
  type TripIdea,
  type TripItinerary,
  type ItineraryDay,
  type TripItinerarySuggestion,
  type TripGroupPhoto,
} from "@/lib/api/trip-groups";
import { ItineraryCalendar, fmtDayDate } from "@/components/trips/itinerary-calendar";
import { AddToCalendarButton } from "@/components/trips/add-to-calendar-button";

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

function DayPhotoStrip({
  day,
  photos,
  canDeletePhoto,
  uploading,
  onUpload,
  onDelete,
}: {
  day: number;
  photos: TripGroupPhoto[];
  canDeletePhoto: (p: TripGroupPhoto) => boolean;
  uploading: boolean;
  onUpload: (day: number, file: File) => void;
  onDelete: (photoId: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-start gap-2">
        {photos.map((p) => (
          <figure key={p.id} className="w-28">
            {/* eslint-disable-next-line @next/next/no-img-element -- bytes come
                from our API / Unsplash hotlink; next/image can't optimize either */}
            <img
              src={p.url}
              alt={p.attribution ?? `Day ${day} photo`}
              loading="lazy"
              className="h-20 w-28 rounded object-cover"
            />
            <figcaption className="mt-0.5 flex items-baseline justify-between gap-1 text-[10px] text-gray-500">
              <span className="truncate">{p.attribution ?? "member photo"}</span>
              {canDeletePhoto(p) && (
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="shrink-0 text-red-400/80 hover:text-red-300"
                  aria-label="Remove photo"
                >
                  remove
                </button>
              )}
            </figcaption>
          </figure>
        ))}
        <label className="flex h-20 w-28 cursor-pointer items-center justify-center rounded border border-dashed border-white/20 text-xs text-gray-500 hover:border-white/40 hover:text-gray-300">
          {uploading ? "Uploading…" : "+ photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(day, f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

const inputCls =
  "rounded border border-white/15 bg-black/30 px-2 py-1 text-sm text-white/90 focus:border-white/40 focus:outline-none";

function ItineraryEditor({
  draft,
  onChange,
}: {
  draft: TripItinerary;
  onChange: (next: TripItinerary) => void;
}) {
  function patchDay(idx: number, patch: Partial<TripItinerary["days"][number]>) {
    const days = draft.days.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onChange({ ...draft, days });
  }
  function patchActivity(
    dayIdx: number,
    actIdx: number,
    patch: Partial<TripItinerary["days"][number]["activities"][number]>,
  ) {
    const days = draft.days.map((d, i) =>
      i === dayIdx
        ? { ...d, activities: d.activities.map((a, j) => (j === actIdx ? { ...a, ...patch } : a)) }
        : d,
    );
    onChange({ ...draft, days });
  }
  function addActivity(dayIdx: number) {
    const days = draft.days.map((d, i) =>
      i === dayIdx
        ? { ...d, activities: [...d.activities, { time: null, title: "New activity", notes: null }] }
        : d,
    );
    onChange({ ...draft, days });
  }
  function removeActivity(dayIdx: number, actIdx: number) {
    const days = draft.days.map((d, i) =>
      i === dayIdx ? { ...d, activities: d.activities.filter((_, j) => j !== actIdx) } : d,
    );
    onChange({ ...draft, days });
  }
  function moveDay(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= draft.days.length) return;
    const days = [...draft.days];
    [days[idx], days[target]] = [days[target], days[idx]];
    // Renumber sequentially so day numbers always match position.
    onChange({ ...draft, days: days.map((d, i) => ({ ...d, day: i + 1 })) });
  }

  return (
    <div>
      <textarea
        value={draft.summary}
        onChange={(e) => onChange({ ...draft, summary: e.target.value })}
        rows={2}
        aria-label="Trip summary"
        className={`${inputCls} block w-full`}
      />
      <ol className="mt-3 space-y-4">
        {draft.days.map((d, di) => (
          <li key={di} className="rounded-md border border-blue-400/30 bg-black/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Day {d.day}</span>
              <input
                value={d.title}
                onChange={(e) => patchDay(di, { title: e.target.value })}
                aria-label={`Day ${d.day} title`}
                className={`${inputCls} min-w-0 flex-1`}
              />
              <input
                value={d.location ?? ""}
                onChange={(e) => patchDay(di, { location: e.target.value || null })}
                placeholder="location"
                aria-label={`Day ${d.day} location`}
                className={`${inputCls} w-32`}
              />
              <input
                type="date"
                value={d.date ?? ""}
                onChange={(e) => patchDay(di, { date: e.target.value || null })}
                aria-label={`Day ${d.day} date`}
                className={`${inputCls} w-36`}
              />
              <input
                value={d.country ?? ""}
                onChange={(e) => patchDay(di, { country: e.target.value || null })}
                placeholder="country"
                aria-label={`Day ${d.day} country`}
                className={`${inputCls} w-28`}
              />
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveDay(di, -1)}
                  disabled={di === 0}
                  aria-label={`Move day ${d.day} up`}
                  className="rounded border border-white/20 px-2 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDay(di, 1)}
                  disabled={di === draft.days.length - 1}
                  aria-label={`Move day ${d.day} down`}
                  className="rounded border border-white/20 px-2 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-30"
                >
                  ↓
                </button>
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {d.activities.map((a, ai) => (
                <li key={ai} className="flex flex-wrap items-center gap-2">
                  <input
                    value={a.time ?? ""}
                    onChange={(e) => patchActivity(di, ai, { time: e.target.value || null })}
                    placeholder="HH:MM"
                    aria-label="Activity time"
                    className={`${inputCls} w-20 font-mono text-xs`}
                  />
                  <input
                    value={a.title}
                    onChange={(e) => patchActivity(di, ai, { title: e.target.value })}
                    aria-label="Activity title"
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                  <input
                    value={a.notes ?? ""}
                    onChange={(e) => patchActivity(di, ai, { notes: e.target.value || null })}
                    placeholder="notes"
                    aria-label="Activity notes"
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => removeActivity(di, ai)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addActivity(di)}
              className="mt-2 text-xs text-blue-300 hover:text-blue-200"
            >
              + add activity
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ItineraryView({
  itinerary,
  photos,
  canDeletePhoto,
  uploadingDay,
  onUploadPhoto,
  onDeletePhoto,
}: {
  itinerary: TripItinerary;
  photos: TripGroupPhoto[];
  canDeletePhoto: (p: TripGroupPhoto) => boolean;
  uploadingDay: number | null;
  onUploadPhoto: (day: number, file: File) => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  const groups: { country: string | null; days: ItineraryDay[] }[] = [];
  for (const d of itinerary.days) {
    const c = d.country ?? null;
    const last = groups[groups.length - 1];
    if (last && last.country === c) last.days.push(d);
    else groups.push({ country: c, days: [d] });
  }

  const renderDay = (d: ItineraryDay) => (
    <li key={d.day} className="rounded-md border border-white/10 bg-black/20 p-3">
      <h3 className="text-sm font-medium text-white/90">
        Day {d.day}
        {fmtDayDate(d.date) && (
          <span className="ml-1.5 text-xs font-normal text-blue-300">{fmtDayDate(d.date)}</span>
        )}
        {": "}
        {d.title}
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
      <DayPhotoStrip
        day={d.day}
        photos={photos.filter((p) => p.day === d.day)}
        canDeletePhoto={canDeletePhoto}
        uploading={uploadingDay === d.day}
        onUpload={onUploadPhoto}
        onDelete={onDeletePhoto}
      />
    </li>
  );

  return (
    <div>
      <p className="text-sm text-gray-400">{itinerary.summary}</p>
      <div className="mt-3 space-y-4">
        {groups.map((g, gi) =>
          g.country ? (
            <details key={gi} open className="group rounded-md border border-white/15 bg-white/[0.03]">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/5">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                {g.country}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {g.days.length} {g.days.length === 1 ? "day" : "days"}
                  {fmtDayDate(g.days[0]?.date) &&
                    ` · ${fmtDayDate(g.days[0]?.date)}${
                      g.days.length > 1 ? ` – ${fmtDayDate(g.days[g.days.length - 1]?.date)}` : ""
                    }`}
                </span>
              </summary>
              <ol className="space-y-4 p-3 pt-1">{g.days.map(renderDay)}</ol>
            </details>
          ) : (
            <ol key={gi} className="space-y-4">
              {g.days.map(renderDay)}
            </ol>
          ),
        )}
      </div>
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
  const [consolidateNotice, setConsolidateNotice] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<TripItinerarySuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [photos, setPhotos] = useState<TripGroupPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingDay, setUploadingDay] = useState<number | null>(null);
  const [filling, setFilling] = useState(false);

  const [draft, setDraft] = useState<TripItinerary | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");

  const refetchPhotos = useCallback(async () => {
    if (!slug) return;
    try {
      setPhotos(await listPhotos(slug));
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  }, [slug]);

  const refetchSuggestions = useCallback(async () => {
    if (!slug) return;
    try {
      setSuggestions(await listSuggestions(slug));
      setSuggestionError(null);
    } catch (err) {
      setSuggestionError((err as Error).message);
    }
  }, [slug]);

  const refetch = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const d = await getGroupDetail(slug);
      setDetail(d);
      setForbidden(false);
      setError(null);
      void refetchSuggestions();
      void refetchPhotos();
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
  }, [slug, refetchSuggestions, refetchPhotos]);

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
    setConsolidateNotice(null);
    try {
      const result = await consolidateItinerary(slug);
      if (result.itinerary && result.itineraryGeneratedAt) {
        // Owner path: direct write.
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                itinerary: result.itinerary ?? prev.itinerary,
                itineraryGeneratedAt: result.itineraryGeneratedAt ?? prev.itineraryGeneratedAt,
              }
            : prev,
        );
      } else if (result.suggestion) {
        // Member path: pending suggestion awaiting owner approval.
        setConsolidateNotice("Suggestion submitted — the group owner can approve it below.");
        await refetchSuggestions();
      }
    } catch (err) {
      setConsolidateError((err as Error).message);
    } finally {
      setConsolidating(false);
    }
  }

  async function handleUploadPhoto(day: number, file: File) {
    if (!slug) return;
    setUploadingDay(day);
    setPhotoError(null);
    try {
      const photo = await uploadPhoto(slug, day, file);
      setPhotos((prev) => [...prev, photo]);
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setUploadingDay(null);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!slug) return;
    try {
      await deletePhoto(slug, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  }

  async function handleUnsplashFill() {
    if (!slug) return;
    setFilling(true);
    setPhotoError(null);
    try {
      const { photos: created, skipped } = await unsplashFill(slug);
      if (created.length > 0) setPhotos((prev) => [...prev, ...created]);
      if (skipped.length > 0) {
        setPhotoError(
          `Some days were skipped: ${skipped.map((s) => `day ${s.day} (${s.reason})`).join("; ")}`,
        );
      }
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setFilling(false);
    }
  }

  async function handleSaveItinerary(next: TripItinerary) {
    if (!slug) return;
    setSavingDraft(true);
    setConsolidateError(null);
    setConsolidateNotice(null);
    try {
      const result = await updateItinerary(slug, next);
      if (result.itinerary && result.itineraryGeneratedAt) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                itinerary: result.itinerary ?? prev.itinerary,
                itineraryGeneratedAt: result.itineraryGeneratedAt ?? prev.itineraryGeneratedAt,
              }
            : prev,
        );
      } else if (result.suggestion) {
        setConsolidateNotice("Edit submitted as a suggestion — the group owner can approve it below.");
        await refetchSuggestions();
      }
    } catch (err) {
      setConsolidateError((err as Error).message);
      throw err;
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSaveDraft() {
    if (!slug || !draft) return;
    if (draft.days.length === 0 || !draft.summary.trim()) {
      setConsolidateError("An itinerary needs a summary and at least one day.");
      return;
    }
    setSavingDraft(true);
    setConsolidateError(null);
    setConsolidateNotice(null);
    try {
      const result = await updateItinerary(slug, draft);
      if (result.itinerary && result.itineraryGeneratedAt) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                itinerary: result.itinerary ?? prev.itinerary,
                itineraryGeneratedAt: result.itineraryGeneratedAt ?? prev.itineraryGeneratedAt,
              }
            : prev,
        );
      } else if (result.suggestion) {
        setConsolidateNotice("Edit submitted as a suggestion — the group owner can approve it below.");
        await refetchSuggestions();
      }
      setDraft(null);
    } catch (err) {
      setConsolidateError((err as Error).message);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleResolve(suggestionId: string, action: "approve" | "reject") {
    if (!slug) return;
    setResolvingId(suggestionId);
    setSuggestionError(null);
    try {
      if (action === "approve") {
        const { itinerary, itineraryGeneratedAt } = await approveSuggestion(slug, suggestionId);
        setDetail((prev) => (prev ? { ...prev, itinerary, itineraryGeneratedAt } : prev));
      } else {
        await rejectSuggestion(slug, suggestionId);
      }
      await refetchSuggestions();
    } catch (err) {
      setSuggestionError((err as Error).message);
    } finally {
      setResolvingId(null);
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

      <section className="mb-8">
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
          <span className="flex shrink-0 gap-2">
            {detail.itinerary && !draft && (
              <span className="flex overflow-hidden rounded border border-white/20" role="group" aria-label="Itinerary view">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  className={`px-2.5 py-1 text-xs ${view === "list" ? "bg-white/15 text-white" : "text-gray-400 hover:bg-white/10"}`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setView("calendar")}
                  aria-pressed={view === "calendar"}
                  className={`px-2.5 py-1 text-xs ${view === "calendar" ? "bg-white/15 text-white" : "text-gray-400 hover:bg-white/10"}`}
                >
                  Calendar
                </button>
              </span>
            )}
            {detail.itinerary && !draft && (
              <button
                type="button"
                onClick={() =>
                  setDraft(JSON.parse(JSON.stringify(detail.itinerary)) as TripItinerary)
                }
                className="inline-flex min-h-9 items-center justify-center rounded border border-white/20 px-3 text-xs font-medium text-gray-300 hover:bg-white/10"
              >
                Edit
              </button>
            )}
            {draft && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                  className="inline-flex min-h-9 items-center justify-center rounded bg-green-600/90 px-3 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {savingDraft
                    ? "Saving…"
                    : detail.isOwner
                      ? "Save itinerary"
                      : "Submit edit as suggestion"}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  disabled={savingDraft}
                  className="inline-flex min-h-9 items-center justify-center rounded border border-white/20 px-3 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
            {!draft && (
              <button
                type="button"
                onClick={handleConsolidate}
                disabled={consolidating || detail.ideas.length === 0}
                className="inline-flex min-h-9 items-center justify-center rounded bg-blue-500/90 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {consolidating
                  ? "Consolidating… (~30s)"
                  : detail.isOwner
                    ? detail.itinerary
                      ? "Re-consolidate from ideas"
                      : "Consolidate ideas into itinerary"
                    : "Suggest AI re-consolidation"}
              </button>
            )}
          </span>
        </div>
        {consolidateError && (
          <p role="alert" className="mb-2 text-sm text-red-400">
            Couldn&apos;t consolidate: {consolidateError}
          </p>
        )}
        {consolidateNotice && (
          <p role="status" className="mb-2 text-sm text-green-400">
            {consolidateNotice}
          </p>
        )}
        {photoError && (
          <p role="alert" className="mb-2 text-sm text-amber-400">{photoError}</p>
        )}
        {detail.itinerary && !draft && (
          <div className="mb-3 flex flex-wrap items-start gap-2">
            {detail.isOwner && (
              <button
                type="button"
                onClick={handleUnsplashFill}
                disabled={filling}
                className="inline-flex min-h-8 items-center rounded border border-white/20 px-2.5 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                {filling ? "Fetching from Unsplash…" : "Fill missing days with Unsplash photos"}
              </button>
            )}
            <AddToCalendarButton slug={detail.slug} />
          </div>
        )}
        {draft ? (
          <ItineraryEditor draft={draft} onChange={setDraft} />
        ) : detail.itinerary && view === "calendar" ? (
          <ItineraryCalendar
            itinerary={detail.itinerary}
            canEdit
            saving={savingDraft}
            onSave={handleSaveItinerary}
          />
        ) : detail.itinerary ? (
          <ItineraryView
            itinerary={detail.itinerary}
            photos={photos}
            canDeletePhoto={(p) => detail.isOwner || (!!user?.id && p.uploaderId === user.id)}
            uploadingDay={uploadingDay}
            onUploadPhoto={handleUploadPhoto}
            onDeletePhoto={handleDeletePhoto}
          />
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

      {suggestions.some((s) => s.status === "pending") && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-gray-300">
            Pending suggestions
            <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
              {suggestions.filter((s) => s.status === "pending").length}
            </span>
          </h2>
          {suggestionError && (
            <p role="alert" className="mb-2 text-sm text-red-400">{suggestionError}</p>
          )}
          <ul className="space-y-2">
            {suggestions
              .filter((s) => s.status === "pending")
              .map((s) => (
                <li key={s.id} className="rounded-md border border-amber-500/20 bg-black/20 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm text-white/90">
                      {s.authorName ?? "Anonymous"} suggested a new itinerary
                      <span className="ml-2 text-xs text-gray-500">
                        <RelativeTime iso={s.createdAt} />
                        {" · "}
                        {s.changedDays.length === 0
                          ? "no day changes"
                          : `changes day${s.changedDays.length > 1 ? "s" : ""} ${s.changedDays.join(", ")}`}
                      </span>
                    </span>
                    {detail.isOwner && (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolve(s.id, "approve")}
                          disabled={resolvingId === s.id}
                          className="inline-flex min-h-8 items-center rounded bg-green-600/90 px-2.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(s.id, "reject")}
                          disabled={resolvingId === s.id}
                          className="inline-flex min-h-8 items-center rounded border border-white/20 px-2.5 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </span>
                    )}
                  </div>
                  {(s.conflictsWith?.length ?? 0) > 0 && (
                    <p className="mt-1.5 text-xs text-amber-400">
                      ⚠ Conflicts with another pending suggestion on the same day
                      {s.changedDays.length > 1 ? "s" : ""} — approving one may invalidate the
                      other.
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500">{s.itinerary.summary}</p>
                </li>
              ))}
          </ul>
        </section>
      )}

    </div>
  );
}
