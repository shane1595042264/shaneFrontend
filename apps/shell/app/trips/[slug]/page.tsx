import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TripActions } from "@/components/trips/trip-actions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface TripFull {
  id: string;
  slug: string;
  title: string | null;
  html: string;
  sourceFilename: string | null;
  ownerName: string | null;
  createdAt: string;
}

async function fetchTrip(slug: string): Promise<TripFull | null> {
  const res = await fetch(`${API_URL}/api/trips/${slug}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load trip: ${res.status}`);
  return (await res.json()).trip;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await fetchTrip(slug).catch(() => null);
  if (!trip) return { title: "Trip not found" };
  return {
    title: `${trip.title || slug} — Trips — Shane`,
    description: trip.title ? `${trip.title} — uploaded ${new Date(trip.createdAt).toLocaleDateString()}` : undefined,
  };
}

export default async function TripPage({ params }: PageProps) {
  const { slug } = await params;
  const trip = await fetchTrip(slug);
  if (!trip) notFound();

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-white/10 bg-black px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/trips" className="text-gray-500 hover:text-gray-300">← Trips</Link>
            <span className="text-gray-600">/</span>
            <span className="font-medium text-white">{trip.title || trip.slug}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {new Date(trip.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              {trip.ownerName ? ` · ${trip.ownerName}` : ""}
            </span>
            <TripActions slug={trip.slug} title={trip.title} />
          </div>
        </div>
      </header>

      {/*
        sandbox isolates the uploaded HTML's CSS/JS from the parent site.
        allow-scripts: lets Claude-generated interactive pages run their JS.
        allow-popups + allow-popups-to-escape-sandbox: outbound links open.
        We deliberately omit allow-same-origin so the iframe can't read
        anything from shanejli.com (cookies, localStorage).
      */}
      <iframe
        srcDoc={trip.html}
        title={trip.title || trip.slug}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        className="block h-[calc(100vh-49px)] w-full border-0 bg-white"
      />
    </div>
  );
}
