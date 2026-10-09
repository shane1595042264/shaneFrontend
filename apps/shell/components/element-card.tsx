"use client";

import Link from "@/components/transition-link";
import { useEffect, useId, useRef } from "react";
import { motion } from "framer-motion";
import type { ElementConfig } from "@shane/types";
import { CATEGORY_STYLES } from "@/lib/elements";

interface ElementCardProps {
  element: ElementConfig;
  atomicNumber: number;
  /**
   * How this card relates to the active element search, if any.
   * undefined = no search running, render exactly as before.
   */
  searchState?: "dimmed" | "match" | "active";
}

// Ring styles live on the card itself; the dim lives on the non-motion wrapper
// below, because framer-motion writes an inline `opacity` from itemVariants
// that would win over any opacity utility class on the animated node.
const SEARCH_RING_CLASSES: Record<
  NonNullable<ElementCardProps["searchState"]>,
  string
> = {
  dimmed: "",
  match: "ring-1 ring-white/60",
  active: "ring-2 ring-white shadow-lg shadow-white/20",
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.85 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

export function ElementCard({
  element,
  atomicNumber,
  searchState,
}: ElementCardProps) {
  const styles = CATEGORY_STYLES[element.category] || CATEGORY_STYLES["projects"];
  const isComingSoon = element.status === "coming-soon";
  const isExternal = element.type === "external";
  const tooltipText = isComingSoon ? "Coming soon" : element.description || null;
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  // Clamp tooltip horizontally so it never clips off the viewport — happens on
  // narrow screens with long descriptions or when the card is near a viewport
  // edge (column 1 / column 18, or after the user has horizontally scrolled
  // the periodic table on mobile).
  useEffect(() => {
    if (!tooltipText) return;
    const el = tooltipRef.current;
    if (!el) return;

    const PAD = 8;
    let raf: number | null = null;
    const measure = () => {
      raf = null;
      el.style.transform = "translateX(-50%)";
      const rect = el.getBoundingClientRect();
      if (rect.left < PAD) {
        el.style.transform = `translateX(calc(-50% + ${Math.ceil(PAD - rect.left)}px))`;
      } else if (rect.right > window.innerWidth - PAD) {
        el.style.transform = `translateX(calc(-50% - ${Math.ceil(rect.right - window.innerWidth + PAD)}px))`;
      }
    };
    const schedule = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", schedule, { passive: true });
    // capture: true catches scroll events from the periodic-table's
    // overflow-x-auto container, which don't bubble to window otherwise.
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
    };
  }, [tooltipText]);

  const ariaLabel = isComingSoon
    ? `${element.name} (${element.symbol}) — coming soon`
    : isExternal
      ? `${element.name} (${element.symbol}) — opens in a new tab`
      : `${element.name} (${element.symbol}) — open page`;

  const wrapperClass = `transition-opacity ${
    searchState === "dimmed" ? "opacity-20" : ""
  }`;

  // SHAN-506: only the link branches use this. `group/card` has to sit on the
  // node that actually takes focus (see the note on the card below), the UA
  // outline is suppressed because it computes to a ~black 1px ring that is
  // invisible on this permanently-dark theme, and focus-visible:opacity-100
  // keeps a tab stop legible when a running element search has dimmed it.
  const linkWrapperClass = `${wrapperClass} group/card focus-visible:outline-none focus-visible:opacity-100`;

  // SHAN-558: dark glass tiles. The category lives in a thin stroke along the
  // top, the symbol's tint and a tinted hover glow, and `.spot` (globals.css)
  // lets the pointer light the tile's border from inside.
  const cardContent = (
    <motion.div
      variants={itemVariants}
      whileHover={isComingSoon ? {} : { scale: 1.06, y: -3, zIndex: 10 }}
      whileTap={isComingSoon ? {} : { scale: 0.96 }}
      tabIndex={isComingSoon ? 0 : undefined}
      className={[
        "spot relative flex flex-col items-center justify-between p-1 md:p-1.5 rounded-lg border select-none w-full aspect-square bg-white/[0.025] transition-[box-shadow,border-color,background-color] duration-500",
        styles.border,
        isComingSoon ? "" : `hover:bg-white/[0.05] ${styles.glow}`,
        searchState ? SEARCH_RING_CLASSES[searchState] : "",
        // SHAN-506: `group/card` marks the focused node, not the card, because
        // Tailwind compiles `group-focus-visible/card:` to
        // `.group\/card:focus-visible &` — a marker on a descendant of the
        // focused element can never match it. For a coming-soon tile the only
        // focusable node IS this div (tabIndex=0), so the marker and the ring
        // both belong here; for a real tile they live on the wrapping link and
        // the ring reaches this card through the group.
        isComingSoon
          ? "group/card opacity-50 cursor-not-allowed outline-none focus-visible:opacity-80 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:z-10"
          : "cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-black/40 group-focus-visible/card:ring-2 group-focus-visible/card:ring-white/70 group-focus-visible/card:z-10",
      ].join(" ")}
    >
      {tooltipText && (
        <span
          ref={tooltipRef}
          id={tooltipId}
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover/card:opacity-100 group-focus-visible/card:opacity-100 group-active/card:opacity-100 transition-opacity duration-200 z-50 whitespace-normal text-center break-words max-w-[12rem] rounded-md bg-gray-950/90 backdrop-blur-md border border-white/10 px-2 py-1 text-[10px] leading-snug text-gray-200 shadow-lg"
        >
          {tooltipText}
        </span>
      )}

      {isComingSoon && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 text-[6px] md:text-[8px] px-1 py-px rounded-sm bg-white/10 text-gray-200 font-medium tracking-wide leading-none"
        >
          Soon
        </span>
      )}

      {isExternal && !isComingSoon && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-0.5 text-[7px] md:text-[9px] opacity-60"
        >
          ↗
        </span>
      )}

      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-1.5 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${styles.line}`}
      />

      <span
        aria-hidden="true"
        className="font-mono text-[7px] md:text-[9px] text-gray-400 self-start leading-none"
      >
        {atomicNumber}
      </span>

      <span
        aria-hidden="true"
        className={`text-sm md:text-xl font-semibold tracking-[-0.03em] text-center leading-none ${styles.text}`}
      >
        {element.symbol}
      </span>

      {/* data-vt-title: the name morphs into the element page's heading on click. */}
      <span
        aria-hidden="true"
        data-vt-title
        className="text-[6px] md:text-[9px] text-center text-gray-300 truncate w-full leading-none"
      >
        {element.name}
      </span>
    </motion.div>
  );

  if (isComingSoon) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        aria-disabled="true"
        className={wrapperClass}
      >
        {cardContent}
      </div>
    );
  }

  // SHAN-506: aria-describedby surfaces element.description to assistive tech.
  // The visual tooltip is the description, and it used to be aria-hidden with
  // nothing else carrying the text, so a screen reader heard only the name.
  const describedBy = tooltipText ? tooltipId : undefined;

  if (isExternal && element.url) {
    return (
      <a
        href={element.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className={linkWrapperClass}
        onClick={(e) => {
          if (e.defaultPrevented) return;
        }}
        draggable={false}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link
      href={element.route || "/"}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className={linkWrapperClass}
      draggable={false}
    >
      {cardContent}
    </Link>
  );
}
