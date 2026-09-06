import { ImageResponse } from "next/og";
import { DOC_PAGES, getDocPage } from "@/lib/docs/registry";

export const alt = "shanejli.com API documentation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The docs are static content modules, so every card can be baked at build
// time with no fetch and no runtime rendering. Mirrors dynamicParams = false on the
// page itself: a slug outside DOC_PAGES has no page, so it needs no card.
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

// Orange is the `tools` category colour the Documentation element (Dc) already
// wears on the periodic table (packages/config/tailwind.config.ts).
const ACCENT = "#f97316";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  const title = page?.title ?? "Documentation";
  const description =
    page?.description ?? "Developer documentation for the shanejli.com APIs.";
  const titleSize = title.length > 24 ? 80 : title.length > 16 ? 92 : 108;

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
            "radial-gradient(circle at 15% 10%, rgba(249,115,22,0.20) 0%, transparent 55%), radial-gradient(circle at 88% 92%, rgba(249,115,22,0.10) 0%, transparent 55%)",
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
            color: ACCENT,
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
              border: `2px solid ${ACCENT}`,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              color: ACCENT,
              letterSpacing: 0,
              // The eyebrow row is uppercased; periodic-table symbols are not.
              textTransform: "none",
            }}
          >
            Dc
          </div>
          <div style={{ display: "flex" }}>Documentation</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1,
            marginTop: 36,
            color: "#fafafa",
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            lineHeight: 1.35,
            marginTop: 28,
            color: "#d4d4d8",
            opacity: 0.85,
            maxWidth: 980,
          }}
        >
          {description}
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
          <div style={{ display: "flex", color: ACCENT, letterSpacing: 1 }}>
            shanejli.com/docs/{slug}
          </div>
          <div style={{ display: "flex" }}>Shane Li</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
