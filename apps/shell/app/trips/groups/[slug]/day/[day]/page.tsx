"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  getGroupDetail,
  listPhotos,
  uploadPhoto,
  deletePhoto,
  type TripGroupDetail,
  type TripGroupPhoto,
} from "@/lib/api/trip-groups";
import { fmtDayDate } from "@/components/trips/itinerary-calendar";
import { buildPhotoResolver, photoBgStyle, PhotoCredit } from "@/components/trips/trip-photos";

/**
 * Day detail page (SHAN-281): /trips/groups/[slug]/day/[N]. The itinerary
 * list keeps one background per country group; THIS page is where the
 * day-specific photo lives — own day photo first, then city, then country
 * — painted full-bleed behind the day's activities.
 */
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
  const [uploading, setUploading] = useState(false);

  const refetch = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [d, p] = await Promise.all([getGroupDetail(slug), listPhotos(slug)]);
      setDetail(d);
      setPhotos(p);
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

  async function handleUpload(day: number, file: File) {
    if (!slug) return;
    setUploading(true);
    try {
      const photo = await uploadPhoto(slug, day, file);
      setPhotos((prev) => [...prev, photo]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: string) {
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

  const day = detail?.itinerary?.days.find((d) => d.day === dayNum);

  if (error || !detail || !day) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href={`/trips/groups/${slug ?? ""}`} className="text-sm text-gray-500 hover:text-gray-300">
          ← back to group
        </Link>
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error ?? "This day doesn't exist in the itinerary."}
        </p>
      </div>
    );
  }

  const resolver = buildPhotoResolver(detail.itinerary!, photos);
  const photo = resolver.forDay(day);
  const ownPhoto = photos.find((p) => p.day === day.day) ?? null;
  const prev = detail.itinerary!.days.find((d) => d.day === day.day - 1);
  const next = detail.itinerary!.days.find((d) => d.day === day.day + 1);
  const canDelete = !!ownPhoto && (detail.isOwner || ownPhoto.uploaderId === user?.id);

  return (
    <div
      className="min-h-screen"
      style={photo ? photoBgStyle(photo.url, [0.6, 0.92]) : undefined}
    >
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={`/trips/groups/${detail.slug}`}
            className="text-sm text-gray-300 hover:text-white"
          >
            ← {detail.title}
          </Link>
          <span className="flex gap-3 text-sm">
            {prev && (
              <Link
                href={`/trips/groups/${detail.slug}/day/${prev.day}`}
                className="text-gray-300 hover:text-white"
              >
                ← day {prev.day}
              </Link>
            )}
            {next && (
              <Link
                href={`/trips/groups/${detail.slug}/day/${next.day}`}
                className="text-gray-300 hover:text-white"
              >
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

        <section className="rounded-lg border border-white/15 bg-black/40 p-4 backdrop-blur-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-300">Activities</h2>
          {day.activities.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nothing planned yet — open the group page and edit the itinerary to add activities.
            </p>
          ) : (
            <ol className="space-y-3">
              {day.activities.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-14 shrink-0 pt-0.5 text-right font-mono text-xs text-gray-400">
                    {a.time ?? "all day"}
                  </span>
                  <span className="border-l border-white/15 pl-3">
                    <span className="block text-base text-white">{a.title}</span>
                    {a.notes && <span className="mt-0.5 block text-sm text-gray-400">{a.notes}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <PhotoCredit
          photo={photo}
          day={day.day}
          canDelete={canDelete}
          uploading={uploading}
          onUpload={handleUpload}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
