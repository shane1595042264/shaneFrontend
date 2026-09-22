import { ImageResponse } from "next/og";
import {
  FEATURED_PROJECTS,
  PORTFOLIO_HERO,
  RESERVED_SLOTS,
} from "@/lib/portfolio";

/**
 * The share card for "/" (SHAN-519).
 *
 * This used to draw four periodic-table tiles under the headline "Periodic
 * Table of Life". SHAN-517 made Portfolio the view every signed-out visitor
 * (and every crawler that renders) actually lands on, and SHAN-518 moved the
 * title and description to match, but the card was left behind: the preview on
 * LinkedIn, Slack, Discord and iMessage still promised a periodic table over a
 * "Shane Li, Software Engineer" title, and then opened on a portfolio hero
 * that looked like neither. This draws the hero instead.
 *
 * The copy and the project list are imported rather than retyped so the card
 * cannot drift away from the page again, and so that adding an entry to
 * FEATURED_PROJECTS updates the card in the same edit.
 *
 * Kept out of app/page.tsx's `openGraph.images`: naming the file there
 * collapses the five og:image tags this convention emits down to one bare URL
 * (SHAN-518), and the alt below is the whole point of the ticket.
 */

export const alt =
  "Shane Li, software engineer in Texas. I build small things and keep most of them.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The Portfolio view's two atmosphere washes, at the same hues and roughly the
 * same placement. Stronger here than the 10% the page uses: a card is looked
 * at as a ~500px thumbnail in a feed, where a wash that subtle disappears.
 */
const BACKGROUND_WASH =
  "radial-gradient(circle at 12% 8%, rgba(147,51,234,0.24) 0%, transparent 55%), " +
  "radial-gradient(circle at 92% 88%, rgba(20,184,166,0.18) 0%, transparent 55%)";

/** teal-400, the same dot the live project cards wear on the page. */
const LIVE = "#2dd4bf";

/**
 * Blurb metrics. Separate consts because the box needs an explicit height and
 * that height has to be derived from them rather than guessed (see the comment
 * at the call site for why satori cannot measure it).
 *
 * BLURB_LINES is how many lines PORTFOLIO_HERO.blurb wraps into at this size
 * and width. If the copy grows past that budget the extra line would be
 * clipped, so the length is asserted at module scope instead of discovered in
 * a link preview weeks later: a rough character budget for two lines at 25px
 * across 820px is ~63 characters a line.
 */
const BLURB_FONT_SIZE = 25;
const BLURB_LINE_HEIGHT = 1.4;
const BLURB_WIDTH = 820;
const BLURB_LINES = 2;
const BLURB_CHAR_BUDGET = BLURB_LINES * 63;

if (PORTFOLIO_HERO.blurb.length > BLURB_CHAR_BUDGET) {
  throw new Error(
    `app/opengraph-image.tsx: PORTFOLIO_HERO.blurb is ${PORTFOLIO_HERO.blurb.length} characters, ` +
      `which no longer fits the ${BLURB_LINES}-line box on the homepage share card ` +
      `(budget ${BLURB_CHAR_BUDGET}). Shorten the copy in lib/portfolio.ts, or raise BLURB_LINES ` +
      `here and re-render the card to check it still clears the tiles below.`,
  );
}

/**
 * One row, three tiles, always. Real projects first, then as many of the
 * page's dashed reserved slots as it takes to fill the row.
 *
 * The cap is what keeps the row inside 1200px when a fourth project is added,
 * and the padding with reserved slots is what stops today's single entry from
 * sitting alone in a third of the frame. It also carries the same meaning the
 * slots carry on the page: this is a selection, not the whole list.
 */
const TILE_COUNT = 3;
const CARD_PROJECTS = FEATURED_PROJECTS.slice(0, TILE_COUNT);
const CARD_SLOTS = RESERVED_SLOTS.slice(
  0,
  Math.max(0, TILE_COUNT - CARD_PROJECTS.length),
);

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
          backgroundImage: BACKGROUND_WASH,
          color: "#fafafa",
          fontFamily: "sans-serif",
          padding: 52,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 21,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#a1a1aa",
          }}
        >
          {PORTFOLIO_HERO.eyebrow}
        </div>

        {/*
          Two lines, broken where the page breaks them. next/og has no <br />,
          so each line is its own flex row.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 20,
            fontSize: 58,
            fontWeight: 600,
            letterSpacing: -2,
            lineHeight: 1.12,
            color: "#ffffff",
          }}
        >
          {PORTFOLIO_HERO.headline.map((line) => (
            <div key={line} style={{ display: "flex" }}>
              {line}
            </div>
          ))}
        </div>

        {/*
          Explicit width and height, unlike every other box here.
          next/og lays this out with satori, which measures a wrapping
          paragraph's box as a single line however many lines it actually
          draws. Left to itself this block reports ~38px tall, the row below it
          starts 38px down, and the blurb's second line renders straight
          through it. The height below is derived from the metrics above plus
          slack, and BLURB_CHAR_BUDGET guards the copy it was measured against.
          flexShrink pins it: this column is close enough to 630px that without
          it the box gets squeezed back to the wrong height and the collision
          returns.
        */}
        <div
          style={{
            display: "flex",
            marginTop: 20,
            flexShrink: 0,
            fontSize: BLURB_FONT_SIZE,
            lineHeight: BLURB_LINE_HEIGHT,
            width: BLURB_WIDTH,
            height: BLURB_LINES * BLURB_FONT_SIZE * BLURB_LINE_HEIGHT + 8,
            color: "#9ca3af",
          }}
        >
          {PORTFOLIO_HERO.blurb}
        </div>

        {/*
          The page's "Selected work" label and its hairline rule. This is the
          one auto margin in the column, so it absorbs whatever vertical slack
          the hero above leaves: the tile row and the footer stay pinned to the
          bottom of the frame whether the headline runs two lines or three,
          instead of the whole lower half sliding up with it.
        */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 18,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#9ca3af",
            }}
          >
            {PORTFOLIO_HERO.sectionLabel}
          </div>
          <div
            style={{
              display: "flex",
              height: 1,
              flexGrow: 1,
              background: "rgba(255,255,255,0.14)",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 20, flexShrink: 0 }}>
          {CARD_PROJECTS.map((project) => (
            <div
              key={project.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                padding: "14px 22px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 18,
                  color: "#9ca3af",
                }}
              >
                <div style={{ display: "flex", letterSpacing: 3 }}>
                  {project.year}
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: LIVE,
                  }}
                />
                <div style={{ display: "flex" }}>{project.host}</div>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: -1,
                  color: "#ffffff",
                }}
              >
                {project.name}
              </div>
            </div>
          ))}

          {CARD_SLOTS.map((slot) => (
            <div
              key={slot}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: "1px dashed rgba(255,255,255,0.14)",
                borderRadius: 16,
                padding: "14px 22px",
                minWidth: 150,
              }}
            >
              <div
                style={{ display: "flex", fontSize: 18, letterSpacing: 3, color: "#6b7280" }}
              >
                {slot}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
                {[0, 1, 2].map((dot) => (
                  <div
                    key={dot}
                    style={{
                      display: "flex",
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.25)",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/*
          Fixed rather than auto: the Selected work row above already claims
          the slack with marginTop: auto, and a second auto would split it and
          leave the lower half floating in the middle of the frame.
        */}
        <div
          style={{
            display: "flex",
            marginTop: 24,
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#a1a1aa",
          }}
        >
          <div style={{ display: "flex", letterSpacing: 1, color: LIVE }}>
            shanejli.com
          </div>
          <div style={{ display: "flex" }}>
            {/* The other view, named the way the page names it in its footer. */}
            The rest is a periodic table
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
