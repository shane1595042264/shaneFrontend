"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  FEATURED_PROJECTS,
  PORTFOLIO_HERO,
  RESERVED_SLOTS,
} from "@/lib/portfolio";

/**
 * The Portfolio view of the homepage (SHAN-517) — what a signed-out visitor
 * lands on. The periodic table is an index of everything Shane runs, which is
 * the wrong first impression for a stranger; this shows the short list.
 *
 * Every muted tone here is text-gray-400 or lighter. That is the only Tailwind
 * gray that clears WCAG AA on this #0a0a0a background, and lib/contrast-guard.ts
 * fails the build on anything darker. The same reason is why the atmosphere
 * (the drifting glow, the hairline rules, the reserved slots) is built out of
 * backgrounds and borders rather than dim text.
 */
export function PortfolioView({
  /**
   * False while the Table view is showing. This subtree stays mounted then
   * (see components/home-view.tsx for why), and the two glows below loop
   * forever, so without this they would keep driving a transform every frame
   * on a `display: none` element for the whole session.
   */
  active,
  onShowTable,
}: {
  active: boolean;
  onShowTable: () => void;
}) {
  // Everything below animates in. Honour the OS setting rather than assume a
  // slow fade is harmless: this is the first thing a visitor sees, so it is
  // also the worst place to ignore prefers-reduced-motion.
  const reduceMotion = useReducedMotion();
  const drift = active && !reduceMotion;

  const rise = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <div className="relative w-full overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pt-24 md:px-12">
      {/*
        Atmosphere. Two very soft radial washes, drifting slowly past each
        other. They sit behind everything, take no pointer events, and are
        aria-hidden — they carry no information, only mood. Held completely
        still rather than removed when the drift is off (reduced motion, or
        this view not being the one on screen), so the page looks the same,
        just not moving.
      */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-purple-600/10 blur-[120px]"
        animate={drift ? { x: [0, 60, 0], y: [0, 40, 0] } : undefined}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-20 h-[30rem] w-[30rem] rounded-full bg-teal-500/10 blur-[120px]"
        animate={drift ? { x: [0, -50, 0], y: [0, 60, 0] } : undefined}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto flex max-w-3xl flex-col gap-16 sm:gap-20">
        <motion.header
          {...rise}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col gap-5"
        >
          <span className="text-[11px] uppercase tracking-[0.4em] text-gray-400">
            {PORTFOLIO_HERO.eyebrow}
          </span>
          {/*
            The line break is data, not layout (SHAN-519): app/opengraph-image.tsx
            renders the same two lines so the share card breaks where the page
            does. Hence the explicit <br /> between the array entries rather
            than letting the container wrap wherever it lands.
          */}
          <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-5xl">
            {PORTFOLIO_HERO.headline[0]}
            <br />
            {PORTFOLIO_HERO.headline[1]}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-gray-400 sm:text-base">
            {PORTFOLIO_HERO.blurb}
          </p>
        </motion.header>

        <section aria-labelledby="featured-work" className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <h2
              id="featured-work"
              className="shrink-0 text-[11px] uppercase tracking-[0.3em] text-gray-400"
            >
              {PORTFOLIO_HERO.sectionLabel}
            </h2>
            <span aria-hidden="true" className="h-px grow bg-white/10" />
          </div>

          {FEATURED_PROJECTS.map((project, index) => (
            <motion.a
              key={project.id}
              {...rise}
              transition={{
                duration: 0.7,
                ease: "easeOut",
                delay: reduceMotion ? 0 : 0.12 + index * 0.08,
              }}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${project.name} — ${project.tagline} Opens ${project.host} in a new tab.`}
              /*
                group/project rather than a bare `group`: the reserved slots
                below use their own group, and an unnamed one would let a hover
                anywhere in the section light up every card.
              */
              className="group/project relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors duration-500 hover:border-white/25 focus-visible:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:p-8"
            >
              {/*
                The card's one flourish: a wash that is invisible at rest and
                resolves on hover or keyboard focus. Slow on purpose — the
                brief was nonchalant, and a fast reveal reads as eager.
              */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-teal-500/10 opacity-0 transition-opacity duration-700 group-hover/project:opacity-100 group-focus-visible/project:opacity-100"
              />

              <div className="relative flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    aria-hidden="true"
                    className="font-mono text-[11px] tracking-widest text-gray-400"
                  >
                    {project.year}
                  </span>
                  <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-teal-400"
                    />
                    Live
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {project.name}
                  </span>
                  <span className="font-mono text-xs text-gray-400">
                    {project.host}
                  </span>
                </div>

                <p className="max-w-2xl text-base leading-relaxed text-gray-200 sm:text-lg">
                  {project.tagline}
                </p>
                <p className="max-w-2xl text-sm leading-relaxed text-gray-400">
                  {project.blurb}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] tracking-wide text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="ml-auto text-sm text-gray-200 transition-transform duration-500 group-hover/project:translate-x-1">
                    Open {project.host}{" "}
                    <span aria-hidden="true">&#8599;</span>
                  </span>
                </div>
              </div>
            </motion.a>
          ))}

          {/*
            Reserved slots. One card alone reads like the entire portfolio;
            these say it is a selection. Decoration only — aria-hidden, not
            focusable, no link, no text a screen reader would have to sit
            through.
          */}
          <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
            {RESERVED_SLOTS.map((slot) => (
              <div
                key={slot}
                className="group/slot flex items-center justify-between rounded-2xl border border-dashed border-white/10 px-6 py-6 transition-colors duration-500 hover:border-white/20"
              >
                <span className="font-mono text-[11px] tracking-widest text-gray-400">
                  {slot}
                </span>
                <span className="flex gap-1.5">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1 w-1 rounded-full bg-white/25 transition-colors duration-500 group-hover/slot:bg-white/50"
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>

        <motion.footer
          {...rise}
          transition={{
            duration: 0.7,
            ease: "easeOut",
            delay: reduceMotion ? 0 : 0.3,
          }}
          className="flex flex-col gap-3 border-t border-white/10 pt-8"
        >
          <p className="text-sm text-gray-400">
            The rest of it is filed as a periodic table. Journals, trackers,
            half-finished tools, a few links out.
          </p>
          {/*
            A button, not a link: the table is already in this document and
            switching is a client-side toggle. The table's own internal links
            ship in the server HTML either way (see components/home-view.tsx),
            so crawlers are not walled off by this being a button.
          */}
          <button
            type="button"
            onClick={onShowTable}
            className="group/table inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 transition-colors duration-300 hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Open the periodic table
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover/table:translate-x-1"
            >
              &#8594;
            </span>
          </button>
        </motion.footer>
      </div>
    </div>
  );
}
