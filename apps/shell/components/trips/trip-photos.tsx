"use client";

import type { TripItinerary, ItineraryDay, TripGroupPhoto } from "@/lib/api/trip-groups";

/**
 * Shared photo plumbing for the trip-group pages (SHAN-281). Photos are
 * design backgrounds: one per country group on the itinerary list, the
 * day-specific photo on the day detail page. Resolution is day-own photo
 * first, then city (location), then country.
 */

export function buildPhotoResolver(itinerary: TripItinerary, photos: TripGroupPhoto[]) {
  const meta = new Map(itinerary.days.map((d) => [d.day, d]));
  const byDay = new Map<number, TripGroupPhoto>();
  const byLocation = new Map<string, TripGroupPhoto>();
  const byCountry = new Map<string, TripGroupPhoto>();
  for (const p of photos) {
    if (!byDay.has(p.day)) byDay.set(p.day, p);
    const m = meta.get(p.day);
    if (!m) continue;
    if (m.location && !byLocation.has(m.location)) byLocation.set(m.location, p);
    if (m.country && !byCountry.has(m.country)) byCountry.set(m.country, p);
  }
  return {
    forDay: (d: ItineraryDay): TripGroupPhoto | null =>
      byDay.get(d.day) ??
      (d.location ? byLocation.get(d.location) : undefined) ??
      (d.country ? byCountry.get(d.country) : undefined) ??
      null,
    forCountry: (c: string): TripGroupPhoto | null => byCountry.get(c) ?? null,
  };
}

/** Shaded photo background layer for cards and sections. */
export function photoBgStyle(url: string, darkness: [number, number]) {
  return {
    backgroundImage: `linear-gradient(rgba(8,8,12,${darkness[0]}), rgba(8,8,12,${darkness[1]})), url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as const;
}

/** Attribution credit + set/replace/remove photo control. */
export function PhotoCredit({
  photo,
  day,
  canDelete,
  uploading,
  onUpload,
  onDelete,
}: {
  photo: TripGroupPhoto | null;
  day: number;
  canDelete: boolean;
  uploading: boolean;
  onUpload: (day: number, file: File) => void;
  onDelete: (photoId: string) => void;
}) {
  return (
    <div className="mt-2 flex items-baseline justify-end gap-2 text-[10px] text-gray-500">
      {photo?.attribution && <span className="truncate">{photo.attribution}</span>}
      {photo && canDelete && (
        <button
          type="button"
          onClick={() => onDelete(photo.id)}
          className="shrink-0 text-red-400/70 hover:text-red-300"
        >
          remove
        </button>
      )}
      <label className="shrink-0 cursor-pointer text-gray-500 hover:text-gray-300">
        {uploading ? "uploading…" : photo ? "replace photo" : "set photo"}
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
  );
}
