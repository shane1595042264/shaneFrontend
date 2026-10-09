"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  FEATURED_PROJECTS,
  PORTFOLIO_HERO,
  portfolioSlotLabel,
  PROFILE_LINKS,
  RESERVED_SLOTS,
} from "@/lib/portfolio";

/**
 * How long to leave `.portfolio-rise` on the tree before dropping it.
 *
 * The longest entrance is the footer: a 0.3s delay plus a 0.7s rise. The extra
 * 200ms is slack, so a slow frame cannot strip the class out from under an
 * animation still in flight and snap the element to its end state.
 */
const ENTRANCE_SETTLED_MS = 1200;

/**
 * The stagger offset for one entrance, as the custom property
 * `.portfolio-rise` reads its `animation-delay` from.
 */
function riseDelay(seconds: number): CSSProperties {
  return { "--portfolio-rise-delay": `${seconds}s` } as CSSProperties;
}

/**
 * The Portfolio view of the homepage (SHAN-517): what a signed-out visitor
 * lands on.
 *
 * SHAN-558 restyled it for the site-wide redesign: layered ("double bezel")
 * cards lit from inside by the pointer (the `.spot` class in app/globals.css),
 * a breathing live dot, and a two-tone headline. The atmosphere is the
 * site-wide aura (app/globals.css), CSS and transform-only. The two
 * framer-motion glows that used to drift here are gone; a local glow inside
 * this overflow-hidden container showed its clipped edge as a hard line.
 *
 * Two constraints carried over unchanged, both measured:
 *  - SHAN-549: nothing above the fold fades in from opacity 0. The entrance is
 *    the transform-only `.portfolio-rise`, so the hero text is legible, and
 *    LCP-eligible, on the first frame.
 *  - Every muted tone is text-gray-400 or lighter (lib/contrast-guard.ts).
 */
export function PortfolioView({
  /**
   * False while the Table view is showing. This subtree stays mounted then
   * (components/home-view.tsx explains why) inside a `display: none` parent,
   * which already stops its CSS animations; the flag is surfaced as a data
   * attribute for anything that wants to key off it.
   */
  active,
  onShowTable,
}: {
  active: boolean;
  onShowTable: () => void;
}) {
  /*
    The entrance is a one-shot, and this is what keeps it one. Taking an
    element out of `display: none` restarts its animations, so without this
    the whole Portfolio would rise again every time the visitor toggled back
    from the table. The first client render still carries the class, matching
    the server HTML.
  */
  const [entranceDone, setEntranceDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEntranceDone(true), ENTRANCE_SETTLED_MS);
    return () => clearTimeout(timer);
  }, []);
  const rise = entranceDone ? "" : "portfolio-rise";

  return (
    <div
      data-active={active ? "true" : "false"}
      className="relative w-full overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pt-24 md:px-12"
    >
      <div className="relative mx-auto flex max-w-3xl flex-col gap-16 sm:gap-20">
        <header className={`flex flex-col gap-5 ${rise}`}>
          <span className="flex items-center gap-2.5 font-mono text-xs text-gray-400">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            {PORTFOLIO_HERO.eyebrow}
          </span>
          {/*
            The line break is data, not layout (SHAN-519): app/opengraph-image.tsx
            renders the same two lines so the share card breaks where the page
            does. The second line is the quieter tone of the pair.
          */}
          <h1 className="text-[2.1rem] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-6xl">
            {PORTFOLIO_HERO.headline[0]}
            <br />
            <span className="text-gray-400">{PORTFOLIO_HERO.headline[1]}</span>
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-gray-400 sm:text-lg">
            {PORTFOLIO_HERO.blurb}
          </p>
        </header>

        <section aria-labelledby="featured-work" className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <h2 id="featured-work" className="shrink-0 font-mono text-xs text-gray-400">
              {PORTFOLIO_HERO.sectionLabel}
            </h2>
            <span aria-hidden="true" className="h-px grow bg-gradient-to-r from-white/10 to-transparent" />
          </div>

          {FEATURED_PROJECTS.map((project, index) => (
            <a
              key={project.id}
              style={riseDelay(0.12 + index * 0.08)}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${project.name}: ${project.tagline} Opens ${project.host} in a new tab.`}
              className={`spot group/project block rounded-[1.75rem] border border-white/[0.08] bg-white/[0.015] p-1.5 transition-[border-color,translate] duration-500 hover:-translate-y-0.5 hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50 ${rise}`}
            >
              <div className="relative flex flex-col gap-5 rounded-[calc(1.75rem-0.375rem)] bg-gray-950/70 p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] sm:p-8">
                <div className="flex items-baseline justify-between gap-4">
                  <span aria-hidden="true" className="font-mono text-xs text-gray-400">
                    {portfolioSlotLabel(index)}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-xs text-gray-400">
                    <span aria-hidden="true" className="live-dot h-1.5 w-1.5 rounded-full bg-teal-400" />
                    live
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                    {project.name}
                  </span>
                  <span className="font-mono text-xs text-gray-400">{project.host}</span>
                </div>

                <p className="max-w-2xl text-base leading-relaxed text-gray-200 sm:text-lg">
                  {project.tagline}
                </p>
                <p className="max-w-2xl text-sm leading-relaxed text-gray-400">{project.blurb}</p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 font-mono text-[11px] text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="ml-auto inline-flex items-center gap-2.5 rounded-full border border-white/10 py-1 pl-4 pr-1 text-sm text-gray-200 transition-colors duration-500 group-hover/project:border-white/20 group-hover/project:text-white">
                    Open {project.host}
                    <span
                      aria-hidden="true"
                      className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] transition-transform duration-500 group-hover/project:-translate-y-px group-hover/project:translate-x-0.5"
                    >
                      &#8599;
                    </span>
                  </span>
                </div>
              </div>
            </a>
          ))}

          {/*
            Reserved slots. A list with no open end reads like the entire
            portfolio; these say it is a selection. Decoration only: aria-hidden,
            not focusable, no link. Full-width rows because the list is derived
            and its length changes with the project count (SHAN-544).
          */}
          {RESERVED_SLOTS.length > 0 && (
            <div aria-hidden="true" className="flex flex-col gap-4">
              {RESERVED_SLOTS.map((slot) => (
                <div
                  key={slot}
                  className="group/slot flex items-center justify-between rounded-[1.75rem] border border-dashed border-white/[0.08] px-7 py-6 transition-colors duration-500 hover:border-white/15"
                >
                  <span className="font-mono text-xs text-gray-400">{slot}</span>
                  <span className="flex gap-1.5">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-1 w-1 rounded-full bg-white/20 transition-colors duration-500 group-hover/slot:bg-teal-300/60"
                      />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer
          className={`flex flex-col gap-6 border-t border-white/[0.08] pt-8 ${rise}`}
          style={riseDelay(0.3)}
        >
          {/*
            SHAN-521: the four profiles the Person JSON-LD on this route declares
            in `sameAs`, read from the same const app/page.tsx uses, so the two
            can never disagree. Real anchors: these leave the site.
          */}
          <nav aria-label="Shane's profiles elsewhere">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {PROFILE_LINKS.map((profile) => (
                <li key={profile.id}>
                  <a
                    href={profile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${profile.label}: opens ${profile.host} in a new tab.`}
                    className="rounded text-sm text-gray-400 underline-offset-4 transition-colors duration-300 hover:text-white hover:underline focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    {profile.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-400">
              The rest of it is filed as a periodic table. Journals, trackers,
              half-finished tools, a few links out.
            </p>
            {/*
              A button, not a link: the table is already in this document and
              switching is a client-side toggle (components/home-view.tsx).
            */}
            <button
              type="button"
              onClick={onShowTable}
              className="group/table inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.02] py-1 pl-5 pr-1 text-sm text-gray-200 transition-colors duration-300 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Open the periodic table
              <span
                aria-hidden="true"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] transition-transform duration-300 group-hover/table:translate-x-0.5"
              >
                &#8594;
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
