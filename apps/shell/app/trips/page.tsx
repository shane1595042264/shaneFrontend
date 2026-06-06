import Link from "next/link";
import { RelativeTime } from "@/lib/format-time";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Render at request time, not build time — avoids "/api/trips returns 404
// while the backend deploy is still propagating" build failures.
export const dynamic = "force-dynamic";

interface TripListItem {
  id: string;
  slug: string;
  title: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

// 60s threshold: createdAt + updatedAt are both DB-defaulted at INSERT so
// they're equal at creation. Only flag as "edited" when PATCH has actually
// moved updatedAt forward materially, so the badge means what it says.
const EDIT_THRESHOLD_MS = 60_000;
function wasMateriallyEdited(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > EDIT_THRESHOLD_MS;
}

async function fetchTrips(): Promise<TripListItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/trips`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()).trips;
  } catch {
    return [];
  }
}

export default async function TripsIndexPage() {
  const trips = await fetchTrips();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Trips</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Travel itineraries — drop in an HTML file and it becomes its own page.
          </p>
        </div>
        <Link
          href="/trips/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          <span aria-hidden="true">＋</span>
          Upload HTML
        </Link>
      </header>

      {trips.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No trips yet. <Link href="/trips/new" className="underline">Upload your first one.</Link>
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {trips.map((t) => (
            <li key={t.id}>
              <Link
                href={`/trips/${t.slug}`}
                className="block rounded-md border border-white/10 bg-black/20 p-4 transition-colors hover:bg-black/30"
              >
                <h2 className="font-medium text-white">
                  {t.title || <span className="italic text-gray-400">Untitled</span>}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  <RelativeTime iso={t.createdAt} />
                  {" · "}
                  {t.ownerName ?? <span className="italic text-gray-600">Anonymous</span>}
                  {wasMateriallyEdited(t.createdAt, t.updatedAt) && (
                    <>
                      {" · edited "}
                      <RelativeTime iso={t.updatedAt} />
                    </>
                  )}
                </p>
                <p className="mt-2 font-mono text-[11px] text-gray-600">/trips/{t.slug}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
