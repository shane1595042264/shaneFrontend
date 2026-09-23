"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ElementConfig } from "@shane/types";
import { PeriodicTable } from "./periodic-table";
import { PortfolioView } from "./portfolio-view";
import { useAuth } from "@/lib/auth-context";

/**
 * The homepage's two faces (SHAN-517).
 *
 * "portfolio" is the curated short list a stranger should land on; "table" is
 * the full periodic-table index, which is what the homepage has always been
 * and what a signed-in Shane still wants by default.
 */
type HomeMode = "portfolio" | "table";

/**
 * What the server renders, and therefore what the hydration render must also
 * produce. Portfolio, because that is the view for signed-out visitors, and
 * every crawler and every first-time human is signed out.
 */
const SSR_MODE: HomeMode = "portfolio";

const STORAGE_KEY = "shane:home-view";

function isHomeMode(value: string | null): value is HomeMode {
  return value === "portfolio" || value === "table";
}

/** localStorage throws outright in some privacy modes; a view preference is never worth a crash. */
function readStoredMode(): HomeMode | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isHomeMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function HomeView({ elements }: { elements: ElementConfig[] }) {
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<HomeMode>(SSR_MODE);

  /**
   * True once the opening view has been decided — by a stored preference, by
   * the resolved session, or by the visitor clicking the switch. It exists so
   * the auth effect below cannot yank the page out from under someone who has
   * already chosen, which would otherwise happen every time /api/auth/me
   * resolves after a click.
   */
  const settled = useRef(false);

  /*
    Deciding the mode happens here rather than in render, and that is the whole
    reason this is safe. Reading `user` during render on a page the server
    prerendered is exactly the SHAN-492 shape: the auth context can resolve
    between the provider committing and this boundary hydrating, so the
    hydration render would emit markup the server HTML never contained and
    React would throw #418 and client-render the subtree. An effect runs after
    the commit, so the hydration render is always SSR_MODE, always identical to
    the server output.
  */
  useEffect(() => {
    if (settled.current) return;

    const stored = readStoredMode();
    if (stored) {
      settled.current = true;
      setMode(stored);
      return;
    }

    // No stored preference: fall back to the session. Signed out is only
    // knowable once the session has resolved — treating the loading state as
    // signed out would settle on Portfolio and then never reconsider, which is
    // the wrong default for the one person who is ever signed in.
    if (authLoading) return;
    settled.current = true;
    setMode(user ? "table" : "portfolio");
  }, [authLoading, user]);

  /**
   * Set by a switch whose own control is inside the view being hidden, read
   * once by the effect below (SHAN-523). A ref rather than state because
   * handing focus over is not something the page renders differently for, and
   * because the flag has to survive into the commit that reveals the target
   * without causing a second one.
   */
  const handOverFocus = useRef(false);

  /** The table view's heading, the thing focus is handed to. */
  const tableHeadingRef = useRef<HTMLHeadingElement>(null);

  const choose = useCallback(
    (
      next: HomeMode,
      /**
       * True when the control that triggered this switch lives inside the
       * view about to be hidden, so leaving focus where it is would drop it
       * on a `display: none` node and the browser would reset it to <body>.
       */
      fromHiddenControl = false,
    ) => {
      settled.current = true;
      if (fromHiddenControl) handOverFocus.current = true;
      setMode(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Preference simply will not persist. The switch still works.
      }
    },
    [],
  );

  /*
    Hand focus to the heading of the view that just opened.

    Only ever runs for a switch that asked for it, which is why the flag is
    checked before anything else: on mount, and on every switch driven by the
    toggle buttons or by the auth effect above, this must be a no-op. Stealing
    focus on load would fight the skip link, and stealing it off a toggle the
    visitor just pressed would make pressing it again harder.

    Focusing rather than scrolling is deliberate — it settles all three
    symptoms at once. The heading is announced ("Periodic Table of Life,
    heading level 1"), which is the only signal a screen reader gets that the
    view changed; the next Tab continues from the table instead of restarting
    at the skip link; and focus() scrolls the heading into view, which is what
    keeps the visitor off the bottom of the table. The CTA sits at the foot of
    the taller Portfolio page, so without this the browser clamps scroll to the
    shorter page's maximum and opens the table halfway down.
  */
  useEffect(() => {
    if (!handOverFocus.current) return;
    /*
      Cleared before the mode check, and the mode is checked at all, so that a
      request can never outlive the switch it was made for. A CTA activation
      while the table is already showing would have React bail out of the
      re-render, which means this effect never runs and the flag survives into
      whatever switch comes next — and handing focus to the table heading
      during a switch *away* from the table would drop it on a display:none
      node, which is the exact failure this ticket is about. Not reachable by a
      real visitor (the CTA is inside the hidden subtree at that point), but it
      is reachable by a synthetic click, which is how this was verified.
    */
    handOverFocus.current = false;
    if (mode !== "table") return;
    tableHeadingRef.current?.focus();
  }, [mode]);

  /** The Portfolio footer CTA. Its own button is hidden by the switch. */
  const showTableFromPortfolio = useCallback(
    () => choose("table", true),
    [choose],
  );

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mx-auto flex w-full max-w-[1100px] justify-end px-5 pt-5 sm:px-8">
        <div
          role="group"
          aria-label="Homepage view"
          className="inline-flex rounded-full border border-white/10 p-0.5"
        >
          <ModeButton
            active={mode === "portfolio"}
            onClick={() => choose("portfolio")}
          >
            Portfolio
          </ModeButton>
          {/*
            No focus hand-over here, unlike the Portfolio CTA below: this
            button sits outside both subtrees, so it stays visible and keeps
            focus, and its aria-pressed flip is what announces the change.
          */}
          <ModeButton active={mode === "table"} onClick={() => choose("table")}>
            Table
          </ModeButton>
        </div>
      </div>

      {/*
        Both views are always in the document and the inactive one is hidden
        with `display: none`, rather than one of them being unmounted. Three
        reasons, in order of how much they cost to get wrong:

        1. SEO. The periodic table is where the homepage's ~14 internal links
           live. Unmounting it in the default (signed-out) view would strip
           every one of them out of the server HTML that crawlers actually read.
        2. Hydration. Neither subtree appears or disappears between the server
           render and the hydration render; only a class changes, and that
           happens in an effect. There is no node for React to find missing.
        3. Behaviour. Switching does not remount PeriodicTable, so it does not
           refire the slot-assignment fetch or replay the entrance animation.

        `display: none` also takes the hidden view out of the tab order and out
        of the accessibility tree, so the inactive view is not reachable by
        keyboard or announced by a screen reader.
      */}
      <div className={mode === "portfolio" ? "w-full" : "hidden"}>
        <PortfolioView
          active={mode === "portfolio"}
          onShowTable={showTableFromPortfolio}
        />
      </div>

      <div
        className={
          mode === "table"
            ? "flex w-full flex-col items-center justify-center gap-4 px-2 py-6 sm:gap-6 sm:px-4 sm:py-10 md:gap-10 md:px-6 md:py-16"
            : "hidden"
        }
      >
        <div className="text-center">
          {/*
            An h1 in both views. Exactly one of them is ever displayed, since
            the other sits inside a `display: none` subtree and is therefore
            out of the accessibility tree entirely — so this is one visible h1
            per view, not a page with two.
          */}
          {/*
            tabIndex={-1} makes this focusable programmatically without adding
            a Tab stop, the standard shape for a skip target. It is the landing
            point for the Portfolio CTA (SHAN-523) — see the effect above for
            why focus moves at all.

            outline-none is safe precisely because of the -1: nothing can ever
            reach this by keyboard, so there is no keyboard user whose focus
            indicator is being removed. The ring would only ever appear on a
            visitor who just clicked a button somewhere else, which reads as a
            rendering glitch rather than as guidance.
          */}
          <h1
            ref={tableHeadingRef}
            tabIndex={-1}
            className="mb-1 text-xl font-bold tracking-tight outline-none sm:mb-2 sm:text-2xl md:text-4xl"
          >
            Periodic Table of Life
          </h1>
          <p className="text-xs text-gray-400 sm:text-sm">
            Navigate the elements of Shane&apos;s digital world.
          </p>
        </div>
        <PeriodicTable elements={elements} />
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3.5 py-1.5 text-xs tracking-wide transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        active
          ? "bg-white/10 text-white"
          : "text-gray-400 hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
