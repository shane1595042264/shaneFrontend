import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TripActions } from "@/components/trips/trip-actions";
import { RelativeTime } from "@/lib/format-time";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const SITE_URL = "https://shanejli.com";

// Escape `<` so an uploaded trip whose title or body contains "</script>"
// cannot break out of the JSON-LD tag. Mirrors journal/[date]/page.tsx.
function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// Plain-text snippet from the uploaded trip HTML for the JSON-LD description:
// strip tags, collapse whitespace, truncate on a word boundary.
function buildTripSnippet(html: string, max = 155): string {
  const text = html
    // Drop <style>/<script> block *contents* first — otherwise stripping only
    // the tags leaves raw CSS/JS text (e.g. "@page { size: A4 }") in the snippet.
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

interface TripFull {
  id: string;
  slug: string;
  title: string | null;
  html: string;
  sourceFilename: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

// 60s: see /trips/page.tsx — both timestamps are DB-defaulted at INSERT, so
// anything past that is a real PATCH from the public update endpoint.
const EDIT_THRESHOLD_MS = 60_000;
function wasMateriallyEdited(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > EDIT_THRESHOLD_MS;
}

// no-store (not ISR) because trips are mutable via the public PATCH endpoint
// — anyone running the /upload-trip curl recipe expects their next page view
// to reflect the updated HTML, not a stale 60s ISR window. Matches the
// /trips index pattern. Journal uses revalidatePath via journal-revalidate.ts
// because it has frontend mutation paths to hook; trips has no such UI yet.
async function fetchTrip(slug: string): Promise<TripFull | null> {
  const res = await fetch(`${API_URL}/api/trips/${slug}`, { cache: "no-store" });
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
  const title = `${trip.title || slug} — Trips — Shane`;
  const description = trip.title
    ? `${trip.title} — uploaded ${new Date(trip.createdAt).toLocaleDateString()}`
    : undefined;
  const url = `https://shanejli.com/trips/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Shane — Periodic Table of Life",
      type: "article",
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function TripPage({ params }: PageProps) {
  const { slug } = await params;
  const trip = await fetchTrip(slug);
  if (!trip) notFound();

  const name = trip.title || slug;
  const tripUrl = `${SITE_URL}/trips/${slug}`;
  const description = buildTripSnippet(trip.html);
  const personEntity = {
    "@type": "Person" as const,
    name: "Shane Li",
    url: SITE_URL,
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name,
    ...(description ? { description } : {}),
    url: tripUrl,
    image: `${SITE_URL}/opengraph-image`,
    provider: personEntity,
    ...(trip.ownerName ? { author: { "@type": "Person", name: trip.ownerName } } : {}),
    dateCreated: trip.createdAt,
    ...(wasMateriallyEdited(trip.createdAt, trip.updatedAt)
      ? { dateModified: trip.updatedAt }
      : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": tripUrl,
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shane", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Trips", item: `${SITE_URL}/trips` },
      { "@type": "ListItem", position: 3, name, item: tripUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(breadcrumbJsonLd) }}
      />
      <header className="border-b border-white/10 bg-black px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/trips" className="text-gray-500 hover:text-gray-300">← Trips</Link>
            <span className="text-gray-600">/</span>
            <span className="font-medium text-white">{trip.title || trip.slug}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              <RelativeTime iso={trip.createdAt} />
              {" · "}
              {trip.ownerName ?? <span className="italic text-gray-600">Anonymous</span>}
              {wasMateriallyEdited(trip.createdAt, trip.updatedAt) && (
                <>
                  {" · edited "}
                  <RelativeTime iso={trip.updatedAt} />
                </>
              )}
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
