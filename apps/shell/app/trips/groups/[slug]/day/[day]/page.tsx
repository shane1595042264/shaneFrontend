"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  getGroupDetail,
  listPhotos,
  uploadPhoto,
  deletePhoto,
  updateItinerary,
  type TripGroupDetail,
  type TripGroupPhoto,
  type TripItinerary,
  type ItineraryDay,
  type ItineraryActivity,
} from "@/lib/api/trip-groups";
import { fmtDayDate } from "@/components/trips/itinerary-calendar";
import { buildPhotoResolver, photoBgStyle, PhotoCredit } from "@/components/trips/trip-photos";
import { NotesMargin, type NoteAnchorOption } from "@/components/trips/margin-notes";
import {
  listNotes as apiListNotes,
  createNote as apiCreateNote,
  deleteNote as apiDeleteNote,
  type TripGroupNote,
} from "@/lib/api/trip-groups";

/**
 * Day detail page (SHAN-281), interactive timeline (SHAN-282).
 *
 * Time is strictly linear: rows are ordered by time slot, and dragging
 * one activity onto another SWAPS their content while each keeps its
 * original time. Breakfast/lunch/dinner are fixed timeline rows — not
 * events, not draggable — that accept an assigned place to eat. Every
 * edit submits directly through the itinerary PUT (owner direct write,
 * member edits become pending suggestions on the group page).
 */

const MEALS: { key: "breakfast" | "lunch" | "dinner"; label: string; time: string }[] = [
  { key: "breakfast", label: "Breakfast", time: "08:00" },
  { key: "lunch", label: "Lunch", time: "12:30" },
  { key: "dinner", label: "Dinner", time: "19:00" },
];

type TimelineRow =
  | { kind: "activity"; time: string | null; actIdx: number; activity: ItineraryActivity }
  | { kind: "meal"; time: string; meal: "breakfast" | "lunch" | "dinner"; label: string; place: string | null };

function buildTimeline(day: ItineraryDay): { timed: TimelineRow[]; anytime: TimelineRow[] } {
  const rows: TimelineRow[] = [];
  day.activities.forEach((activity, actIdx) => {
    rows.push({ kind: "activity", time: activity.time, actIdx, activity });
  });
  for (const m of MEALS) {
    rows.push({ kind: "meal", time: m.time, meal: m.key, label: m.label, place: day.meals?.[m.key] ?? null });
  }
  const timed = rows
    .filter((r) => r.time !== null)
    .sort((a, b) => (a.time as string).localeCompare(b.time as string));
  const anytime = rows.filter((r) => r.time === null);
  return { timed, anytime };
}

export default function DayDetailPage() {
  return (
    <AuthGate>
      <DayDetail />
    </AuthGate>
  );
}

function DayDetail() {
  const params = useParams<{ slug: string; day: string }>();
  const slug = params?.slug;
  const dayNum = Number(params?.day);
  const { user } = useAuth();

  const [detail, setDetail] = useState<TripGroupDetail | null>(null);
  const [photos, setPhotos] = useState<TripGroupPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Which row's inline editor is open.
  const [editing, setEditing] = useState<
    | { kind: "activity"; actIdx: number }
    | { kind: "meal"; meal: "breakfast" | "lunch" | "dinner" }
    | null
  >(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Click-based swap fallback (works on touch, where HTML5 DnD doesn't):
  // tap one handle to arm, tap another activity's handle to swap.
  const [swapArm, setSwapArm] = useState<number | null>(null);

  const [notes, setNotes] = useState<TripGroupNote[]>([]);
  const [noteAnchor, setNoteAnchor] = useState("day");
  const [noteBusy, setNoteBusy] = useState(false);

  const refetch = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [d, p, n] = await Promise.all([
        getGroupDetail(slug),
        listPhotos(slug),
        apiListNotes(slug).catch(() => [] as TripGroupNote[]),
      ]);
      setDetail(d);
      setPhotos(p);
      setNotes(n);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const day = detail?.itinerary?.days.find((d) => d.day === dayNum);

  async function saveDayPatch(patch: Partial<ItineraryDay>) {
    if (!slug || !detail?.itinerary || !day) return;
    const next: TripItinerary = {
      ...detail.itinerary,
      days: detail.itinerary.days.map((d) => (d.day === dayNum ? { ...d, ...patch } : d)),
    };
    setSaving(true);
    setError(null);
    setNotice(null);
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
        setNotice("Edit submitted as a suggestion — the group owner can approve it on the group page.");
      }
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function patchActivity(actIdx: number, patch: Partial<ItineraryActivity> | null) {
    if (!day) return;
    const activities =
      patch === null
        ? day.activities.filter((_, i) => i !== actIdx)
        : day.activities.map((a, i) => (i === actIdx ? { ...a, ...patch } : a));
    void saveDayPatch({ activities });
  }

  /** Drag-swap: content moves, time slots stay (SHAN-282). */
  function swapActivities(i: number, j: number) {
    if (!day || i === j) return;
    const acts = [...day.activities];
    const a = acts[i];
    const b = acts[j];
    acts[i] = { ...b, time: a.time };
    acts[j] = { ...a, time: b.time };
    void saveDayPatch({ activities: acts });
  }

  async function handleUpload(d: number, file: File) {
    if (!slug) return;
    setUploading(true);
    try {
      const photo = await uploadPhoto(slug, d, file);
      setPhotos((prev) => [...prev, photo]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!slug) return;
    try {
      await deletePhoto(slug, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error && (!detail || !day)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href={`/trips/groups/${slug ?? ""}`} className="text-sm text-gray-500 hover:text-gray-300">
          ← back to group
        </Link>
        <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>
      </div>
    );
  }
  if (!detail || !day) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href={`/trips/groups/${slug ?? ""}`} className="text-sm text-gray-500 hover:text-gray-300">
          ← back to group
        </Link>
        <p role="alert" className="mt-3 text-sm text-red-400">This day doesn&apos;t exist in the itinerary.</p>
      </div>
    );
  }

  const resolver = buildPhotoResolver(detail.itinerary!, photos);
  const photo = resolver.forDay(day);
  const ownPhoto = photos.find((p) => p.day === day.day) ?? null;
  const prev = detail.itinerary!.days.find((d) => d.day === day.day - 1);
  const next = detail.itinerary!.days.find((d) => d.day === day.day + 1);
  const canDeletePhoto = !!ownPhoto && (detail.isOwner || ownPhoto.uploaderId === user?.id);
  const { timed, anytime } = buildTimeline(day);

  const renderRow = (row: TimelineRow) => {
    if (row.kind === "meal") {
      const isEditing = editing?.kind === "meal" && editing.meal === row.meal;
      return (
        <li key={`meal-${row.meal}`} className="flex gap-3">
          <span className="w-14 shrink-0 pt-1 text-right font-mono text-xs text-gray-500">{row.time}</span>
          <div className="flex-1 border-l border-dashed border-white/20 pl-3">
            {isEditing ? (
              <MealEditor
                label={row.label}
                place={row.place}
                saving={saving}
                onCancel={() => setEditing(null)}
                onSave={(place) =>
                  saveDayPatch({ meals: { ...(day.meals ?? {}), [row.meal]: place } })
                }
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing({ kind: "meal", meal: row.meal })}
                className="block w-full rounded px-1 py-0.5 text-left hover:bg-white/5"
              >
                <span className="text-sm italic text-gray-400">{row.label}</span>
                {row.place ? (
                  <span className="ml-2 text-sm text-white/90">@ {row.place}</span>
                ) : (
                  <span className="ml-2 text-xs text-gray-500">add a place to eat</span>
                )}
              </button>
            )}
          </div>
        </li>
      );
    }

    const isEditing = editing?.kind === "activity" && editing.actIdx === row.actIdx;
    const highlighted =
      (dragOverIdx === row.actIdx && dragIdx !== row.actIdx) || swapArm === row.actIdx;
    return (
      <li
        key={`act-${row.actIdx}`}
        className={`flex gap-3 ${highlighted ? "rounded bg-blue-500/15 ring-1 ring-blue-400/50" : ""}`}
        draggable={!isEditing}
        onDragStart={(e) => {
          setDragIdx(row.actIdx);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverIdx(row.actIdx);
        }}
        onDragLeave={() => setDragOverIdx((v) => (v === row.actIdx ? null : v))}
        onDrop={(e) => {
          e.preventDefault();
          if (dragIdx !== null) swapActivities(dragIdx, row.actIdx);
          setDragIdx(null);
          setDragOverIdx(null);
        }}
        onDragEnd={() => {
          setDragIdx(null);
          setDragOverIdx(null);
        }}
      >
        <span className="w-14 shrink-0 pt-1 text-right font-mono text-xs text-gray-400">
          {row.time ?? "anytime"}
        </span>
        <div className="flex-1 border-l border-white/15 pl-3">
          {isEditing ? (
            <ActivityEditor
              activity={row.activity}
              saving={saving}
              onCancel={() => setEditing(null)}
              onSave={(patch) => patchActivity(row.actIdx, patch)}
            />
          ) : (
            <div className="group/row flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (swapArm === null) setSwapArm(row.actIdx);
                  else if (swapArm === row.actIdx) setSwapArm(null);
                  else {
                    swapActivities(swapArm, row.actIdx);
                    setSwapArm(null);
                  }
                }}
                aria-label={
                  swapArm === row.actIdx
                    ? "Cancel swap"
                    : swapArm !== null
                      ? `Swap with ${row.activity.title}`
                      : `Arm swap for ${row.activity.title}`
                }
                title={swapArm === null ? "Tap to swap with another activity (or drag)" : "Tap to swap here"}
                className={`shrink-0 cursor-grab rounded px-1 pt-1 text-sm leading-none ${swapArm === row.actIdx ? "text-blue-300" : "text-gray-600 hover:text-gray-300"}`}
              >
                ⇅
              </button>
              <button
                type="button"
                onClick={() => {
                  if (swapArm !== null && swapArm !== row.actIdx) {
                    swapActivities(swapArm, row.actIdx);
                    setSwapArm(null);
                    return;
                  }
                  setEditing({ kind: "activity", actIdx: row.actIdx });
                }}
                className="block flex-1 cursor-pointer rounded px-1 py-0.5 text-left hover:bg-white/5"
                title="Click to edit · drag onto another activity to swap"
              >
                <span className="block text-base text-white">
                  {row.activity.title}
                </span>
                {row.activity.notes && (
                  <span className="mt-0.5 block text-sm text-gray-400">{row.activity.notes}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setNoteAnchor(`act-${row.actIdx}`)}
                aria-label={`Add note to ${row.activity.title}`}
                title="Add a margin note for this activity"
                className="shrink-0 pt-1 text-xs text-amber-300/70 hover:text-amber-200"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${row.activity.title}"?`)) patchActivity(row.actIdx, null);
                }}
                disabled={saving}
                aria-label={`Delete ${row.activity.title}`}
                className="shrink-0 pt-1 text-xs text-red-400/70 hover:text-red-300 disabled:opacity-50"
              >
                🗑
              </button>
            </div>
          )}
        </div>
      </li>
    );
  };

  const dayNotes = notes.filter(
    (n) => n.anchorType !== "group" && n.anchorDay === day.day,
  );
  const noteAnchorOptions: NoteAnchorOption[] = [
    { value: "day", label: `This day (Day ${day.day})`, anchorType: "day", anchorDay: day.day },
    ...day.activities.map((a, i) => ({
      value: `act-${i}`,
      label: `@ ${a.title}`,
      anchorType: "activity" as const,
      anchorDay: day.day,
      anchorActivity: a.title,
    })),
  ];

  return (
    <div className="min-h-screen" style={photo ? photoBgStyle(photo.url, [0.6, 0.92]) : undefined}>
      <div className="mx-auto max-w-6xl px-4 py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <Link href={`/trips/groups/${detail.slug}`} className="text-sm text-gray-300 hover:text-white">
            ← {detail.title}
          </Link>
          <span className="flex gap-3 text-sm">
            {prev && (
              <Link href={`/trips/groups/${detail.slug}/day/${prev.day}`} className="text-gray-300 hover:text-white">
                ← day {prev.day}
              </Link>
            )}
            {next && (
              <Link href={`/trips/groups/${detail.slug}/day/${next.day}`} className="text-gray-300 hover:text-white">
                day {next.day} →
              </Link>
            )}
          </span>
        </div>

        <header className="mt-10 mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-blue-300">
            Day {day.day}
            {fmtDayDate(day.date) && <span className="ml-2">· {fmtDayDate(day.date)}</span>}
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-white">{day.title}</h1>
          <p className="mt-2 text-sm text-gray-300">
            {[day.location, day.country].filter(Boolean).join(", ")}
          </p>
        </header>

        {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
        {notice && <p role="status" className="mb-3 text-sm text-green-400">{notice}</p>}

        <section className="rounded-lg border border-white/15 bg-black/40 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-gray-300">Timeline</h2>
            <span className="text-[10px] text-gray-500">
              click to edit · ⇅ or drag to swap (times stay put)
            </span>
          </div>
          {swapArm !== null && (
            <p role="status" className="mb-2 text-xs text-blue-300">
              Swap armed — tap another activity to trade places (times stay put), or tap ⇅ again to cancel.
            </p>
          )}
          <ol className="space-y-3">{timed.map(renderRow)}</ol>
          {anytime.length > 0 && (
            <>
              <h3 className="mt-4 mb-2 text-xs uppercase tracking-wide text-gray-500">Anytime</h3>
              <ol className="space-y-3">{anytime.map(renderRow)}</ol>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              const activities = [...day.activities, { time: null, title: "New activity", notes: null }];
              void saveDayPatch({ activities });
              setEditing({ kind: "activity", actIdx: activities.length - 1 });
            }}
            disabled={saving}
            className="mt-4 text-xs text-blue-300 hover:text-blue-200 disabled:opacity-50"
          >
            + add activity
          </button>
        </section>

        <PhotoCredit
          photo={photo}
          day={day.day}
          canDelete={canDeletePhoto}
          uploading={uploading}
          onUpload={handleUpload}
          onDelete={handleDeletePhoto}
        />
      </div>

      <div className="mt-8 lg:mt-0">
        <NotesMargin
          notes={dayNotes}
          anchorOptions={noteAnchorOptions}
          selectedAnchor={noteAnchor}
          onSelectAnchor={setNoteAnchor}
          canDelete={(n) => detail.isOwner || n.authorId === user?.id}
          busy={noteBusy}
          onCreate={async (anchor, body) => {
            setNoteBusy(true);
            try {
              const note = await apiCreateNote(detail.slug, {
                anchorType: anchor.anchorType,
                anchorDay: anchor.anchorDay ?? null,
                anchorActivity: anchor.anchorActivity ?? null,
                body,
              });
              setNotes((prev) => [...prev, note]);
            } finally {
              setNoteBusy(false);
            }
          }}
          onDelete={async (noteId) => {
            await apiDeleteNote(detail.slug, noteId);
            setNotes((prev) => prev.filter((n) => n.id !== noteId));
          }}
        />
      </div>
      </div>
    </div>
  );
}

function ActivityEditor({
  activity,
  saving,
  onCancel,
  onSave,
}: {
  activity: ItineraryActivity;
  saving: boolean;
  onCancel: () => void;
  onSave: (patch: Partial<ItineraryActivity>) => void;
}) {
  const [time, setTime] = useState(activity.time ?? "");
  const [title, setTitle] = useState(activity.title);
  const [notes, setNotes] = useState(activity.notes ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      time: /^\d{1,2}:\d{2}$/.test(time.trim()) ? time.trim().padStart(5, "0") : null,
      title: title.trim(),
      notes: notes.trim() || null,
    });
  }

  const cls =
    "rounded border border-white/15 bg-black/40 px-2 py-1 text-sm text-white/90 focus:border-white/40 focus:outline-none";
  return (
    <form onSubmit={handleSubmit} className="space-y-1.5">
      <div className="flex gap-1.5">
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="HH:MM" aria-label="Time" className={`${cls} w-20 font-mono text-xs`} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" className={`${cls} min-w-0 flex-1`} autoFocus />
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="notes" aria-label="Notes" className={`${cls} block w-full`} />
      <div className="flex gap-2 pt-0.5">
        <button type="submit" disabled={saving || !title.trim()} className="rounded bg-green-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="rounded border border-white/20 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

function MealEditor({
  label,
  place,
  saving,
  onCancel,
  onSave,
}: {
  label: string;
  place: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (place: string | null) => void;
}) {
  const [value, setValue] = useState(place ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(value.trim() || null);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm italic text-gray-400">{label} @</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="place to eat"
        aria-label={`${label} place`}
        autoFocus
        className="min-w-0 flex-1 rounded border border-white/15 bg-black/40 px-2 py-1 text-sm text-white/90 focus:border-white/40 focus:outline-none"
      />
      <button type="submit" disabled={saving} className="rounded bg-green-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={onCancel} disabled={saving} className="rounded border border-white/20 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50">
        Cancel
      </button>
    </form>
  );
}
