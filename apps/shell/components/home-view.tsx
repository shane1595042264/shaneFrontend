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

  const choose = useCallback((next: HomeMode) => {
    settled.current = true;
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply will not persist. The switch still works.
    }
  }, []);

  const showTable = useCallback(() => choose("table"), [choose]);

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
          <ModeButton active={mode === "table"} onClick={showTable}>
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
        <PortfolioView active={mode === "portfolio"} onShowTable={showTable} />
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
          <h1 className="mb-1 text-xl font-bold tracking-tight sm:mb-2 sm:text-2xl md:text-4xl">
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
