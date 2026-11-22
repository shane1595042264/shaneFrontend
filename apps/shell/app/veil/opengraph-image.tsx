import { ImageResponse } from "next/og";

export const alt = "Veil — transparent Twitch chat in your eyeline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#09090e", color: "#f4f1ff", fontFamily: "sans-serif", padding: 58 }}>
      <div style={{ width: "52%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", color: "#a88cff", fontSize: 18, letterSpacing: 5, textTransform: "uppercase" }}>Veil for Windows</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, fontSize: 72, fontWeight: 650, letterSpacing: -4, lineHeight: 1.02 }}>
          <div style={{ display: "flex" }}>Your chat,</div>
          <div style={{ display: "flex", color: "#c7b8ff" }}>in your eyeline.</div>
        </div>
        <div style={{ display: "flex", width: 520, marginTop: 28, color: "#9ca3af", fontSize: 24, lineHeight: 1.45 }}>
          Transparent Twitch chat for the screen you play on.
        </div>
      </div>
      <div style={{ position: "relative", width: "48%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 14, padding: "52px 34px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 26, background: "linear-gradient(145deg,#343d57,#111521 68%)", boxShadow: "0 30px 80px rgba(0,0,0,.45)", fontSize: 20, fontWeight: 650, textShadow: "0 2px 4px #000" }}>
        <div style={{ display: "flex" }}><span style={{ color: "#ff92c9", marginRight: 8 }}>JuniperJay:</span> that movement was clean</div>
        <div style={{ display: "flex" }}><span style={{ color: "#af9aff", marginRight: 8 }}>nightpixel:</span> wait this is gorgeous??</div>
        <div style={{ display: "flex" }}><span style={{ color: "#6ee2ae", marginRight: 8 }}>moss.exe:</span> one more run — you have this ✦</div>
        <div style={{ position: "absolute", right: 26, top: 24, display: "flex", color: "rgba(255,255,255,.45)", fontSize: 13, letterSpacing: 3 }}>0% BACKGROUND</div>
      </div>
    </div>,
    size,
  );
}
