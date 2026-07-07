import { ImageResponse } from "next/og";

export const alt = "Trip itinerary — Shane";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const FALLBACK_BODY =
  "A trip itinerary on Shane Li's periodic table of life — routes, stays, and the plan for the days ahead.";

interface Props {
  params: Promise<{ slug: string }>;
}

interface TripCard {
  title: string | null;
  html: string;
  ownerName: string | null;
}

// Mirrors buildTripSnippet in trips/[slug]/page.tsx: drop <style>/<script>
// block contents, strip remaining tags, decode a couple of entities, collapse
// whitespace, truncate on a word boundary.
function buildTripSnippet(html: string, max = 200): string {
  const text = html
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

async function fetchTrip(slug: string): Promise<TripCard | null> {
  try {
    const res = await fetch(`${API_URL}/api/trips/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { trip?: TripCard };
    return data.trip ?? null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const trip = await fetchTrip(slug);
  const heading = trip?.title?.trim() || "Trip itinerary";
  // Long trip titles (e.g. "Europe Trip — Greece, Italy, Spain — Jul 25 to
  // Aug 8 2026") overflow at 68px; scale the headline down as it grows.
  const headingSize = heading.length > 60 ? 48 : heading.length > 40 ? 58 : 68;
  const body = trip ? buildTripSnippet(trip.html) : FALLBACK_BODY;
  const owner = trip?.ownerName?.trim() || "Shane Li";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(59,130,246,0.18) 0%, transparent 55%), radial-gradient(circle at 85% 90%, rgba(245,158,11,0.14) 0%, transparent 55%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "#3b82f6",
            letterSpacing: 3,
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 36,
              height: 36,
              border: "2px solid #3b82f6",
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              color: "#3b82f6",
              letterSpacing: 0,
            }}
          >
            Tr
          </div>
          <div style={{ display: "flex" }}>Trips</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: headingSize,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.05,
            marginTop: 32,
            color: "#fafafa",
          }}
        >
          {heading}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            lineHeight: 1.35,
            marginTop: 28,
            color: "#d4d4d8",
            opacity: 0.85,
          }}
        >
          {body}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#a1a1aa",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#f59e0b",
              letterSpacing: 1,
            }}
          >
            shanejli.com
          </div>
          <div style={{ display: "flex" }}>{owner}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
