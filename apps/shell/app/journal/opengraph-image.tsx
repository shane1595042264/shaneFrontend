import { ImageResponse } from "next/og";

export const alt = "Shane's Journal — AI-generated daily entries";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
            fontSize: 108,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1,
            marginTop: 36,
            color: "#fafafa",
          }}
        >
          Shane&apos;s Journal
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 32,
            lineHeight: 1.35,
            marginTop: 28,
            color: "#d4d4d8",
            opacity: 0.85,
            maxWidth: 960,
          }}
        >
          AI-generated daily entries from my life — workouts, code, travel, and
          everything in between.
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
            shanejli.com/journal
          </div>
          <div style={{ display: "flex" }}>Shane Li</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
