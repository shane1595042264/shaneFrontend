import { ImageResponse } from "next/og";

export const alt = "Shane — Periodic Table of Life";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const elements = [
    { num: 1, sym: "Jn", name: "Journal", color: "#f59e0b" },
    { num: 4, sym: "Gh", name: "GitHub", color: "#3b82f6" },
    { num: 103, sym: "Rc", name: "RNG", color: "#a78bfa" },
    { num: 105, sym: "Kn", name: "Knowledge", color: "#34d399" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(59,130,246,0.18) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(167,139,250,0.14) 0%, transparent 50%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", gap: 20, marginBottom: 56 }}>
          {elements.map((el) => (
            <div
              key={el.sym}
              style={{
                display: "flex",
                flexDirection: "column",
                width: 140,
                height: 140,
                border: `2px solid ${el.color}`,
                borderRadius: 12,
                padding: 14,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 16,
                  opacity: 0.7,
                  color: el.color,
                }}
              >
                {el.num}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 52,
                  fontWeight: 700,
                  marginTop: 6,
                  color: "#fafafa",
                  lineHeight: 1,
                }}
              >
                {el.sym}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 16,
                  marginTop: "auto",
                  opacity: 0.85,
                  color: el.color,
                }}
              >
                {el.name}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -2,
            textAlign: "center",
            color: "#fafafa",
          }}
        >
          Periodic Table of Life
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            opacity: 0.65,
            marginTop: 18,
            textAlign: "center",
            color: "#fafafa",
          }}
        >
          Navigate the elements of Shane&apos;s digital world
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            marginTop: 40,
            color: "#3b82f6",
            letterSpacing: 1,
          }}
        >
          shanejli.com
        </div>
      </div>
    ),
    { ...size }
  );
}
