import { ImageResponse } from "next/og";

export const alt = "Journal entry — Shane";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

interface Props {
  params: Promise<{ date: string }>;
}

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function stripDataMarkers(text: string): string {
  return text.replace(/\[\[data:[^|]+\|([^|]+)\|[\s\S]+?\]\]/g, "$1");
}

function buildSnippet(content: string, maxLen = 200): string {
  const plain = stripDataMarkers(content).replace(/\s+/g, " ").trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}

async function fetchEntry(date: string): Promise<string | null> {
  try {
    const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries/${date}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { entry?: { content?: string } };
    return data.entry?.content ?? null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: Props) {
  const { date } = await params;
  const validDate = isValidDate(date);
  const content = validDate ? await fetchEntry(date) : null;
  const dateHeading = validDate ? formatDate(date) : "Journal — Shane";
  const body = content
    ? buildSnippet(content)
    : "AI-generated daily journal entries from Shane's life — workouts, code, travel, and more.";

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
            "radial-gradient(circle at 20% 10%, rgba(245,158,11,0.18) 0%, transparent 55%), radial-gradient(circle at 85% 90%, rgba(59,130,246,0.14) 0%, transparent 55%)",
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
            color: "#f59e0b",
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
              border: "2px solid #f59e0b",
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              color: "#f59e0b",
              letterSpacing: 0,
            }}
          >
            Jn
          </div>
          <div style={{ display: "flex" }}>Journal</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.05,
            marginTop: 32,
            color: "#fafafa",
          }}
        >
          {dateHeading}
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
              color: "#3b82f6",
              letterSpacing: 1,
            }}
          >
            shanejli.com
          </div>
          <div style={{ display: "flex" }}>Shane Li</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
