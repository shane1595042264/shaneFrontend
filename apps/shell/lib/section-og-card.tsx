// apps/shell/lib/section-og-card.tsx
//
// The share card for a section index page: /blog, /courses, /trips, /docs,
// /knowledge, /vocabulary, /scoreboard (SHAN-686).
//
// Until this existed those seven pages had no opengraph-image of their own, so
// they inherited app/opengraph-image.tsx. A link to the blog or the course
// catalog unfurled on LinkedIn, Slack, Discord and iMessage as the portfolio
// hero with its project tiles, and the og:image:alt read "Shane Li, software
// engineer in Texas", which is the homepage, not the page that opens.
//
// Drawn in the shape the Journal and Docs cards already use (symbol tile,
// eyebrow, title, one line of copy, URL footer) so every card on the site reads
// as one family. The symbol, the eyebrow name, the colour and the URL come from
// the segment's manifest.ts, the same object the periodic table tile renders,
// so a renamed element or a recoloured category moves the card with it.
import { ImageResponse } from "next/og";
import type { ElementConfig } from "@shane/types";

export interface SectionOgCard {
  manifest: ElementConfig;
  /** The page's own title, minus the " — Shane" suffix. */
  title: string;
  /** One sentence, no more than DESCRIPTION_CHAR_BUDGET characters. */
  description: string;
}

/**
 * Hex values of the element-* colours in packages/config/tailwind.config.ts.
 * next/og cannot read Tailwind classes, so CATEGORY_COLORS in @shane/types is
 * no use here. "data-tracking" has no colour of its own there and falls back to
 * the data blue, the same as its periodic table tile.
 */
const CATEGORY_HEX: Record<string, string> = {
  data: "#3b82f6",
  "data-tracking": "#3b82f6",
  gaming: "#22c55e",
  creative: "#a855f7",
  tools: "#f97316",
  projects: "#14b8a6",
};

const DESCRIPTION_FONT_SIZE = 30;
const DESCRIPTION_LINE_HEIGHT = 1.35;
const DESCRIPTION_WIDTH = 980;
const DESCRIPTION_LINES = 2;
// ~58 characters a line at 30px across 980px, with slack for wide glyphs.
const DESCRIPTION_CHAR_BUDGET = DESCRIPTION_LINES * 58;

const TITLE_CHAR_BUDGET = 24;

/** og:image:alt for a section card. Names the page, not the site owner. */
export function sectionOgAlt(card: SectionOgCard): string {
  return `${card.title} on shanejli.com. ${card.description}`;
}

export function renderSectionOgCard(card: SectionOgCard): ImageResponse {
  const { manifest, title, description } = card;
  const route = manifest.route ?? "";
  // Every card is prerendered at build time (no params, no fetch), so these
  // throw during `npm run build` rather than in a link preview weeks later.
  if (!route) {
    throw new Error(`section-og-card: manifest "${manifest.id}" has no route.`);
  }
  if (description.length > DESCRIPTION_CHAR_BUDGET) {
    throw new Error(
      `section-og-card: the ${route} description is ${description.length} characters, ` +
        `over the ${DESCRIPTION_CHAR_BUDGET} that fit its ${DESCRIPTION_LINES}-line box. Shorten it.`,
    );
  }
  if (title.length > TITLE_CHAR_BUDGET) {
    throw new Error(
      `section-og-card: the ${route} title "${title}" is over ${TITLE_CHAR_BUDGET} characters ` +
        `and would wrap even at 76px. Shorten it.`,
    );
  }

  const accent = CATEGORY_HEX[manifest.category] ?? CATEGORY_HEX.data;
  const titleSize = title.length > 20 ? 76 : title.length > 16 ? 92 : 108;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          // Hex plus a two-digit alpha: 33 is 20%, 1a is 10%.
          backgroundImage: `radial-gradient(circle at 15% 10%, ${accent}33 0%, transparent 55%), radial-gradient(circle at 88% 92%, ${accent}1a 0%, transparent 55%)`,
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
            color: accent,
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
              border: `2px solid ${accent}`,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              color: accent,
              letterSpacing: 0,
              // The eyebrow row is uppercased; periodic-table symbols are not.
              textTransform: "none",
            }}
          >
            {manifest.symbol}
          </div>
          <div style={{ display: "flex" }}>{manifest.name}</div>
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

        {/*
          Explicit height and flexShrink: satori measures a wrapping paragraph
          as one line however many it draws (see app/opengraph-image.tsx).
        */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            flexShrink: 0,
            fontSize: DESCRIPTION_FONT_SIZE,
            lineHeight: DESCRIPTION_LINE_HEIGHT,
            width: DESCRIPTION_WIDTH,
            height: DESCRIPTION_LINES * DESCRIPTION_FONT_SIZE * DESCRIPTION_LINE_HEIGHT + 8,
            color: "#d4d4d8",
            opacity: 0.85,
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
          <div style={{ display: "flex", color: accent, letterSpacing: 1 }}>
            shanejli.com{route}
          </div>
          <div style={{ display: "flex" }}>Shane Li</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
