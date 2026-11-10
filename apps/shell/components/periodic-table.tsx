"use client";

import { useState, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { ElementConfig } from "@shane/types";
import { ElementCard } from "./element-card";
import { ElementSearch } from "./element-search";
import { PlaceholderCard } from "./placeholder-card";
import { LoadError } from "./load-error";
import { searchElements } from "@/lib/element-search";
import {
  PERIODIC_TABLE_ELEMENTS,
  GRID_ROWS,
  GRID_COLS,
  GAP_ROW,
  type ChemicalElement,
} from "@/lib/periodic-table-data";
import {
  type SlotMap,
  fetchSlotAssignments,
  resolveSlots,
  saveSlotAssignments,
  SlotSaveError,
} from "@/lib/slot-assignments";
import { useAuth } from "@/lib/auth-context";
import { isNetworkError } from "@/lib/humanize-error";

interface PeriodicTableProps {
  elements: ElementConfig[];
}

const CELL_BY_POSITION = new Map<string, ChemicalElement>(
  PERIODIC_TABLE_ELEMENTS.map((ce) => [`${ce.row}-${ce.col}`, ce])
);
const CELL_BY_ATOMIC = new Map<number, ChemicalElement>(
  PERIODIC_TABLE_ELEMENTS.map((ce) => [ce.atomicNumber, ce])
);

const ARROW_STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * The nearest table cell from `atomic` in the arrow's direction, walking over
 * the holes in row 1 and the gap row above the lanthanides. null at the edge.
 */
function neighborSlot(atomic: number, key: string): number | null {
  const from = CELL_BY_ATOMIC.get(atomic);
  const step = ARROW_STEPS[key];
  if (!from || !step) return null;
  let row = from.row + step[0];
  let col = from.col + step[1];
  while (row >= 1 && row <= GRID_ROWS && col >= 1 && col <= GRID_COLS) {
    const hit = CELL_BY_POSITION.get(`${row}-${col}`);
    if (hit) return hit.atomicNumber;
    row += step[0];
    col += step[1];
  }
  return null;
}

/**
 * The toast for a failed save. A failure rolls the grid back, so every variant
 * says the tile moved back, and the cause decides what to do next (SHAN-682):
 * a retry fixes a dropped connection, but never an expired sign-in.
 */
function saveErrorMessage(e: unknown): string {
  if (isNetworkError(e)) {
    return "Couldn't save the arrangement. Check your connection; the tile is back where it was.";
  }
  if (e instanceof SlotSaveError && e.status === 401) {
    return "Your sign-in has expired. Sign in again to rearrange; the tile is back where it was.";
  }
  return "Couldn't save the arrangement, so the tile is back where it was. Try the move again.";
}

/** Puts appId in targetAtomic; whatever sat there takes appId's old slot. */
function moveApp(map: SlotMap, appId: string, sourceAtomic: number, targetAtomic: number): SlotMap {
  const next = { ...map };
  const targetAppId = map[targetAtomic];
  if (targetAppId) {
    next[sourceAtomic] = targetAppId;
  } else {
    delete next[sourceAtomic];
  }
  next[targetAtomic] = appId;
  return next;
}

export function PeriodicTable({ elements }: PeriodicTableProps) {
  // Rearranging persists through an auth-only PUT, so only offer the drag to
  // signed-in visitors. Otherwise the save 401s and the toast reads as a broken
  // site rather than "you aren't signed in".
  const { user, loading: authLoading } = useAuth();
  const signedIn = user !== null;
  // True only once the visitor's saved layout has actually arrived. The grid
  // can be revealed at the default order before that (failed fetch, or the
  // 2s timeout below), and since the PUT replaces the whole map, a drop then
  // would save the default order over the real one (SHAN-569).
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const canRearrange = signedIn && layoutLoaded;
  // SHAN-646: a failed load used to look like the visitor's own order with
  // drags quietly off. Retry bumps loadAttempt so the effect refetches in place.
  const [layoutError, setLayoutError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [slotMap, setSlotMap] = useState<SlotMap>(() => resolveSlots(elements, {}));
  // Drops are saved one PUT at a time, always sending the newest arrangement,
  // so PUTs cannot land out of order and a failed save cannot roll back over a
  // later move that saved. confirmedMapRef is the last map the server holds.
  const confirmedMapRef = useRef<SlotMap | null>(null);
  const pendingMapRef = useRef<SlotMap | null>(null);
  const savingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // False until we know which arrangement to draw. The first render can only
  // use the default registry order, and a signed-in visitor's saved order
  // differs from it in most slots, so revealing the grid before the saved map
  // lands makes ~14 cards visibly fly to new cells right after load (SHAN-470).
  const [slotsResolved, setSlotsResolved] = useState(false);
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [saveToast, setSaveToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [query, setQuery] = useState("");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  // SHAN-676: the keyboard alternative to dragging. Space lifts the focused
  // tile, arrows move it (a preview, nothing saves yet), Space or Enter drops
  // it into the save queue and Escape restores liftOriginRef.
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const liftedIdRef = useRef<string | null>(null);
  liftedIdRef.current = liftedId;
  const liftOriginRef = useRef<SlotMap | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const moveHintId = useId();

  const searchResults = useMemo(
    () => searchElements(elements, query),
    [elements, query]
  );

  // null = no active search, so every card renders exactly as before.
  const matchedIds = useMemo(
    () => (query.trim() ? new Set(searchResults.map((el) => el.id)) : null),
    [query, searchResults]
  );

  // Fetch saved assignments client-side only: they're per-user data behind
  // requireAuth, and SSR has no localStorage token, so server-side fetches were
  // guaranteed 401. Waiting for the resolved session rather than firing on mount
  // also covers the stale-token case, where a revoked token is still in
  // localStorage and the request would 401 despite getStoredToken() being set.
  useEffect(() => {
    // Signed out is only knowable once the session has resolved; treating the
    // still-loading state as signed out would mark the slots resolved and
    // reveal the default arrangement a moment before the saved one arrives.
    if (authLoading) return;
    setLayoutLoaded(false);
    setLayoutError(false);
    if (!signedIn) {
      setSlotMap(resolveSlots(elements, {}));
      setSlotsResolved(true);
      return;
    }
    let cancelled = false;
    fetchSlotAssignments().then((saved) => {
      if (cancelled) return;
      const resolved = resolveSlots(elements, saved ?? {});
      setSlotMap(resolved);
      setSlotsResolved(true);
      setLayoutLoaded(saved !== null);
      setLayoutError(saved === null);
      if (saved !== null) confirmedMapRef.current = resolved;
    });
    return () => {
      cancelled = true;
    };
  }, [elements, signedIn, authLoading, loadAttempt]);

  // The grid is invisible until resolution, so a request that never settles
  // (accepted but unanswered; fetchSlotAssignments already swallows outright
  // failures) would hide the homepage indefinitely. Reveal at the default
  // arrangement rather than leave the page looking broken.
  useEffect(() => {
    if (slotsResolved) return;
    const timer = setTimeout(() => setSlotsResolved(true), 2000);
    return () => clearTimeout(timer);
  }, [slotsResolved]);

  const appToSlot = new Map<string, number>();
  for (const [atomic, appId] of Object.entries(slotMap)) {
    appToSlot.set(appId, Number(atomic));
  }

  const appById = new Map<string, ElementConfig>();
  for (const el of elements) {
    appById.set(el.id, el);
  }

  const handleDragStart = useCallback((appId: string) => {
    setDraggedAppId(appId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, atomicNumber: number) => {
      e.preventDefault();
      if (draggedAppId) setDropTarget(atomicNumber);
    },
    [draggedAppId]
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const showToast = useCallback(
    (type: "success" | "error", message: string, ms: number) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setSaveToast({ type, message });
      toastTimerRef.current = setTimeout(() => setSaveToast(null), ms);
    },
    []
  );

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // A drop made while a PUT is in flight only replaces pendingMapRef; the loop
  // picks it up when the PUT settles. A failure is only rolled back when it was
  // the newest arrangement, since a queued one already carries the same move
  // and saving it retries that move too.
  const flushSaves = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    let failure: { error: unknown } | null = null;
    while (pendingMapRef.current) {
      const next = pendingMapRef.current;
      pendingMapRef.current = null;
      try {
        await saveSlotAssignments(next);
        confirmedMapRef.current = next;
        failure = null;
      } catch (e) {
        failure = { error: e };
      }
    }
    savingRef.current = false;
    if (failure) {
      const confirmed = confirmedMapRef.current;
      if (confirmed) setSlotMap(confirmed);
      showToast("error", saveErrorMessage(failure.error), 6000);
    } else {
      showToast("success", "Arrangement saved", 2000);
    }
  }, [showToast]);

  const handleDrop = useCallback(
    (targetAtomic: number) => {
      if (!draggedAppId || !canRearrange) return;
      setDropTarget(null);

      const sourceAtomic = appToSlot.get(draggedAppId);
      if (sourceAtomic === undefined || sourceAtomic === targetAtomic) {
        setDraggedAppId(null);
        return;
      }

      const newSlotMap = moveApp(slotMap, draggedAppId, sourceAtomic, targetAtomic);

      setSlotMap(newSlotMap);
      setDraggedAppId(null);

      pendingMapRef.current = newSlotMap;
      flushSaves();
    },
    [draggedAppId, canRearrange, slotMap, appToSlot, flushSaves]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedAppId(null);
    setDropTarget(null);
  }, []);

  const appName = (appId: string) => appById.get(appId)?.name ?? appId;

  const cancelLift = useCallback(() => {
    const appId = liftedIdRef.current;
    if (!appId) return;
    const origin = liftOriginRef.current;
    liftOriginRef.current = null;
    setLiftedId(null);
    if (origin) setSlotMap(origin);
    const name = elements.find((el) => el.id === appId)?.name ?? appId;
    const slot = origin
      ? Object.entries(origin).find(([, id]) => id === appId)?.[0]
      : undefined;
    setAnnouncement(slot ? `Move cancelled. ${name} is back in slot ${slot}.` : "Move cancelled.");
  }, [elements]);

  const handleTileKeyDown = (e: React.KeyboardEvent, appId: string) => {
    if (!canRearrange || e.altKey || e.ctrlKey || e.metaKey) return;
    const name = appName(appId);

    if (liftedId !== appId) {
      if (e.key === " " && !liftedId) {
        e.preventDefault();
        liftOriginRef.current = slotMap;
        setLiftedId(appId);
        setAnnouncement(
          `Picked up ${name} in slot ${appToSlot.get(appId)}. Arrow keys move it, Space or Enter drops it, Escape cancels.`
        );
      }
      return;
    }

    if (e.key in ARROW_STEPS) {
      e.preventDefault();
      const source = appToSlot.get(appId);
      if (source === undefined) return;
      const target = neighborSlot(source, e.key);
      if (target === null) {
        setAnnouncement(`${name} is at the edge of the table.`);
        return;
      }
      const displaced = slotMap[target];
      setSlotMap(moveApp(slotMap, appId, source, target));
      setAnnouncement(
        displaced
          ? `${name} moved to slot ${target}, swapped with ${appName(displaced)}.`
          : `${name} moved to slot ${target}.`
      );
    } else if (e.key === " " || e.key === "Enter") {
      // Enter would otherwise follow the tile's link.
      e.preventDefault();
      const origin = liftOriginRef.current;
      liftOriginRef.current = null;
      setLiftedId(null);
      // Compare the whole map: a route of swaps can bring the tile back to its
      // own slot while leaving its neighbours moved.
      const changed =
        !origin ||
        Object.keys(origin).length !== Object.keys(slotMap).length ||
        Object.entries(origin).some(([slot, id]) => slotMap[Number(slot)] !== id);
      if (changed) {
        setAnnouncement(`${name} dropped in slot ${appToSlot.get(appId)}.`);
        pendingMapRef.current = slotMap;
        flushSaves();
      } else {
        setAnnouncement(`${name} dropped where it started.`);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelLift();
    }
  };

  // Tabbing or clicking away from a lifted tile puts it back. The check waits a
  // tick because a move can make React reinsert the tile's DOM node, which
  // blurs it until the layout effect below focuses it again.
  const handleTileBlur = () => {
    if (!liftedIdRef.current) return;
    setTimeout(() => {
      const appId = liftedIdRef.current;
      if (!appId) return;
      const tile = scrollRef.current?.querySelector(`[data-element-id="${appId}"]`);
      if (!tile?.contains(document.activeElement)) cancelLift();
    }, 0);
  };

  useLayoutEffect(() => {
    if (!liftedId) return;
    const tile = scrollRef.current?.querySelector<HTMLElement>(
      `[data-element-id="${liftedId}"]`
    );
    if (!tile) return;
    if (!tile.contains(document.activeElement)) {
      tile.querySelector<HTMLElement>('a, [tabindex="0"]')?.focus({ preventScroll: true });
    }
    // Same reason as the search pan below: smooth scrolling is dropped here.
    tile.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }, [liftedId, slotMap]);

  // Signing out, or a layout reload, takes rearranging away mid-move.
  useEffect(() => {
    if (!canRearrange) cancelLift();
  }, [canRearrange, cancelLift]);

  const cells: React.ReactNode[] = [];

  for (let row = 1; row <= GRID_ROWS; row++) {
    if (row === GAP_ROW) {
      cells.push(
        <div
          key="gap"
          style={{ gridRow: row, gridColumn: "1 / -1", height: "8px" }}
        />
      );
      continue;
    }

    for (let col = 1; col <= GRID_COLS; col++) {
      const cellKey = `${row}-${col}`;
      const chemEl = CELL_BY_POSITION.get(cellKey);
      if (!chemEl) continue;

      const assignedAppId = slotMap[chemEl.atomicNumber];
      const assignedApp = assignedAppId ? appById.get(assignedAppId) : undefined;
      const isDropping = dropTarget === chemEl.atomicNumber;

      if (assignedApp) {
        const searchState = !matchedIds
          ? undefined
          : !matchedIds.has(assignedApp.id)
            ? "dimmed"
            : assignedApp.id === activeMatchId
              ? "active"
              : "match";

        cells.push(
          <motion.div
            key={`active-${assignedApp.id}`}
            // Both props are what make a cell change animate, and framer only
            // animates a move when the previous render also had them (it needs
            // the earlier measurement). Withholding them until the saved slots
            // land means the settle render has no snapshot to animate from.
            // Drags, which wait for the saved layout itself, still animate.
            layout={slotsResolved}
            layoutId={slotsResolved ? assignedApp.id : undefined}
            data-element-id={assignedApp.id}
            style={{ gridRow: row, gridColumn: col }}
            className={`relative ${
              liftedId === assignedApp.id
                ? "z-20 ring-2 ring-blue-400 rounded-md"
                : isDropping
                  ? "ring-2 ring-white/50 rounded-md"
                  : ""
            }`}
            draggable={canRearrange}
            onDragStart={() => handleDragStart(assignedApp.id)}
            onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, chemEl.atomicNumber)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(chemEl.atomicNumber)}
            onDragEnd={handleDragEnd}
            onKeyDown={(e) => handleTileKeyDown(e, assignedApp.id)}
            onBlur={handleTileBlur}
          >
            <ElementCard
              element={assignedApp}
              atomicNumber={chemEl.atomicNumber}
              searchState={searchState}
              moveHintId={canRearrange ? moveHintId : undefined}
            />
          </motion.div>
        );
      } else {
        cells.push(
          <div
            key={`chem-${chemEl.atomicNumber}`}
            style={{ gridRow: row, gridColumn: col }}
            className={`${isDropping ? "ring-2 ring-white/50 rounded-md" : ""}`}
            onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, chemEl.atomicNumber)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(chemEl.atomicNumber)}
          >
            <PlaceholderCard element={chemEl} dimmed={matchedIds !== null} />
          </div>
        );
      }
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.01 },
    },
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollIndicators();
    const observer = new ResizeObserver(updateScrollIndicators);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollIndicators]);

  // Pan the grid to the highlighted search result. Without this, arrowing
  // through results on a narrow viewport highlights cards that are scrolled
  // out of sight. block: "nearest" keeps the page from jumping vertically.
  //
  // behavior must stay "auto": verified on prod that a smooth scroll request
  // against this container is silently dropped (scrollLeft never leaves 0),
  // while an instant one pans correctly. The grid is full of framer-motion
  // cards animating transforms, which cancels the smooth scroll before it
  // starts.
  useEffect(() => {
    if (!activeMatchId) return;
    const node = scrollRef.current?.querySelector(
      `[data-element-id="${activeMatchId}"]`
    );
    node?.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
  }, [activeMatchId]);

  return (
    <div className="w-full pb-4 relative">
      {saveToast && (
        <div
          role={saveToast.type === "success" ? "status" : "alert"}
          aria-live={saveToast.type === "success" ? "polite" : "assertive"}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-opacity ${
            saveToast.type === "success"
              ? "bg-green-900/90 text-green-100 border border-green-700/50"
              : "bg-red-900/90 text-red-100 border border-red-700/50"
          }`}
        >
          {saveToast.message}
        </div>
      )}
      {signedIn && layoutError && (
        <div className="mb-3 px-1 text-center">
          <LoadError
            message="Couldn't load your saved arrangement. Showing the default order, and rearranging is off until it loads."
            onRetry={() => setLoadAttempt((n) => n + 1)}
          />
        </div>
      )}
      <ElementSearch
        results={searchResults}
        query={query}
        onQueryChange={setQuery}
        activeId={activeMatchId}
        onActiveIdChange={setActiveMatchId}
      />
      {/* The scroll-edge gradients are positioned against the grid only, so the
          search bar above them never sits under a fade on mobile. */}
      <div className="relative">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/60 to-transparent z-10 pointer-events-none md:hidden" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/60 to-transparent z-10 pointer-events-none md:hidden" />
        )}
        {/*
          Named, keyboard-scrollable region. The grid pans horizontally on narrow
          viewports (overflow-x-auto); without role/aria-label/tabindex a
          keyboard-only user can't reach the off-screen columns and a screen
          reader announces ~30 links with no context (WCAG 2.1.1 + 1.3.1).
          tabIndex is 0 only when there's actual overflow to scroll — otherwise
          the region would be a spurious tab stop on desktop where nothing pans.
          A focusable overflow container scrolls natively with arrow keys, so no
          custom key handler is needed.
        */}
        <div
          ref={scrollRef}
          role="region"
          aria-label="Periodic table of Shane's apps and projects"
          tabIndex={canScrollLeft || canScrollRight ? 0 : -1}
          className="overflow-x-auto md:overflow-x-visible scrollbar-hide rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onScroll={updateScrollIndicators}
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            // Hold the entrance (cards inherit it through itemVariants) until
            // the arrangement is final, so the table fades in once, already in
            // the right order, instead of fading in and then rearranging.
            animate={slotsResolved ? "visible" : "hidden"}
            className="periodic-grid mx-auto"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_COLS}, minmax(48px, 1fr))`,
              gridTemplateRows: `repeat(${GRID_ROWS}, auto)`,
              gap: "2px",
              maxWidth: "1100px",
              minWidth: `${GRID_COLS * 50}px`,
            }}
          >
            {cells}
          </motion.div>
        </div>
      </div>
      {/* Below the grid, so it appearing once the saved layout lands never
          shifts the table. It doubles as every tile's accessible description. */}
      {canRearrange && (
        <p id={moveHintId} className="mt-3 text-center text-xs text-gray-400">
          Drag tiles to rearrange them, or focus one, press Space, move it with
          the arrow keys and press Space again.
        </p>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
