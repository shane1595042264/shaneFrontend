"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  motionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { formatPartTime, type JournalTocPart } from "@/lib/journal-toc";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useScrollLock } from "@/lib/use-scroll-lock";

/**
 * Where "currently reading" sits: a quarter of the way down the viewport. A
 * heading the rail scrolled to lands 1.5rem from the top (scroll-mt-under-header), which is
 * comfortably above this line, so the row you clicked is the row that lights up.
 */
const ACTIVE_LINE = 0.25;

const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 } as const;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** Which part, and which section inside it, the reader is in. `id` is null between a part's top and its first section. */
interface Position {
  part: string | null;
  id: string | null;
}

interface Row {
  top: number;
  part: string;
  id: string | null;
}

interface Span {
  top: number;
  bottom: number;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * The scroll spy behind both the rail and the mobile sheet.
 *
 * Offsets are measured once and re-measured only when something resizes (a
 * mermaid diagram finishing, an image loading, an append being edited), so a
 * scroll frame does no layout reads: it compares the page offset against a
 * cached, sorted list. React state changes only when the active row does; the
 * per-part fills and the overall progress are motion values, so the rail's
 * progress lines move without re-rendering anything.
 *
 * Driven by framer-motion's useScroll rather than a scroll listener of our own,
 * which batches to the frame loop.
 */
function useReadingPosition(parts: JournalTocPart[]) {
  const reduce = useReducedMotion() ?? false;
  const fills = useMemo(() => parts.map(() => motionValue(0)), [parts]);
  const overall = useMemo(() => motionValue(0), []);
  const [position, setPosition] = useState<Position>({ part: parts[0]?.key ?? null, id: null });
  const rows = useRef<Row[]>([]);
  const spans = useRef<(Span | null)[]>([]);
  // While a click-initiated scroll is in flight the spy holds the clicked row,
  // so the indicator does not tick through every section the page passes on the
  // way there.
  const held = useRef<Position | null>(null);
  const cancelHold = useRef<() => void>(() => {});
  const { scrollY } = useScroll();

  const update = useCallback(() => {
    const line = window.scrollY + window.innerHeight * ACTIVE_LINE;
    const all = spans.current;
    all.forEach((s, i) => {
      fills[i]?.set(s ? clamp01((line - s.top) / Math.max(1, s.bottom - s.top)) : 0);
    });
    const first = all.find((s): s is Span => !!s);
    const last = [...all].reverse().find((s): s is Span => !!s);
    if (first && last) overall.set(clamp01((line - first.top) / Math.max(1, last.bottom - first.top)));

    if (held.current) return;
    let current = rows.current[0];
    for (const r of rows.current) if (r.top <= line) current = r;
    if (!current) return;
    const next = current;
    setPosition((prev) =>
      prev.part === next.part && prev.id === next.id ? prev : { part: next.part, id: next.id }
    );
  }, [fills, overall]);

  useEffect(() => {
    const measure = () => {
      const y = window.scrollY;
      const nextRows: Row[] = [];
      const nextSpans: (Span | null)[] = [];
      for (const p of parts) {
        const anchor = document.getElementById(p.anchorId);
        if (!anchor) {
          nextSpans.push(null);
          continue;
        }
        const r = anchor.getBoundingClientRect();
        nextSpans.push({ top: r.top + y, bottom: r.bottom + y });
        nextRows.push({ top: r.top + y, part: p.key, id: null });
        for (const s of p.sections) {
          // Missing while that append is open in the editor; it comes back on save.
          const el = document.getElementById(s.id);
          if (el) nextRows.push({ top: el.getBoundingClientRect().top + y, part: p.key, id: s.id });
        }
      }
      nextRows.sort((a, b) => a.top - b.top);
      rows.current = nextRows;
      spans.current = nextSpans;
      update();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    for (const p of parts) {
      const anchor = document.getElementById(p.anchorId);
      if (anchor) ro.observe(anchor);
    }
    return () => ro.disconnect();
  }, [parts, update]);

  useMotionValueEvent(scrollY, "change", update);

  useEffect(() => () => cancelHold.current(), []);

  const jump = useCallback(
    (anchorId: string, next: Position) => {
      const el = document.getElementById(anchorId);
      if (!el) return;
      cancelHold.current();
      held.current = next;
      setPosition(next);

      let timer = 0;
      const stop = () => {
        window.clearTimeout(timer);
        window.removeEventListener("scrollend", release);
      };
      function release() {
        stop();
        cancelHold.current = () => {};
        held.current = null;
        update();
      }
      cancelHold.current = stop;
      // scrollend where it exists; the timer covers Safari, and a click on the
      // row you are already at, which scrolls nowhere and never ends.
      window.addEventListener("scrollend", release, { once: true });
      timer = window.setTimeout(release, reduce ? 80 : 1200);

      // "smooth" is safe here: it is the window scrolling, not a framer-motion
      // container (those drop it, see the periodic grid).
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      // replaceState, not a hash navigation: a hashchange would re-arm
      // MarkdownHashScroll, which jumps instantly and cuts the smooth scroll off.
      window.history.replaceState(window.history.state, "", `#${anchorId}`);
    },
    [reduce, update]
  );

  return { position, fills, overall, jump, reduce };
}

function onPlainClick(e: MouseEvent<HTMLAnchorElement>, go: () => void) {
  // Leave modified clicks alone so cmd/ctrl-click still opens the anchor in a new tab.
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  go();
}

/** "12 min left", counting down as the reader moves through the day's parts. */
function MinutesLeft({
  overall,
  minutes,
  className,
}: {
  overall: MotionValue<number>;
  minutes: number;
  className?: string;
}) {
  const text = useTransform(overall, (p) =>
    p >= 0.995 ? "Finished" : `${Math.max(1, Math.ceil(minutes * (1 - p)))} min left`
  );
  // aria-hidden: it changes on every scroll frame, which is noise to a screen
  // reader; the page header already states the total reading time.
  return (
    <motion.span aria-hidden="true" className={className}>
      {text}
    </motion.span>
  );
}

/** The highlight behind the active row. Shares a layoutId so it slides between rows. */
function ActivePill({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      layoutId={reduce ? undefined : "active-row"}
      transition={SPRING}
      className="absolute inset-0 rounded-md bg-white/[0.06] ring-1 ring-inset ring-white/10"
    />
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-[5px] w-[5px] border-b border-r border-current transition-transform duration-300 motion-reduce:transition-none ${
        open ? "-translate-y-px rotate-45" : "-rotate-45"
      }`}
    />
  );
}

interface ListProps {
  parts: JournalTocPart[];
  entryDate: string;
  position: Position;
  fills: MotionValue<number>[];
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
  onJump: (anchorId: string, next: Position) => void;
  instance: "rail" | "sheet";
  reduce: boolean;
}

/**
 * The outline itself: one timeline node per part, labelled with when it was
 * written, and that part's sections nested under it. Only the part being read
 * is expanded, so a day with seven long appends reads as a timeline first and an
 * outline second; the count button opens any other part to look inside.
 */
function TocList({
  parts,
  entryDate,
  position,
  fills,
  isOpen,
  onToggle,
  onJump,
  instance,
  reduce,
}: ListProps) {
  const activeIndex = parts.findIndex((p) => p.key === position.part);

  return (
    <LayoutGroup id={`journal-toc-${instance}`}>
      <ol>
        {parts.map((p, i) => {
          const hasSections = p.sections.length > 0;
          const open = hasSections && isOpen(p.key);
          const state = i < activeIndex ? "past" : i === activeIndex ? "current" : "ahead";
          const partActive = state === "current" && position.id === null;
          const isLast = i === parts.length - 1;
          const listId = `journal-toc-${instance}-${p.key}`;
          return (
            <li key={p.key} className="relative pb-1 pl-5">
              {/* The rail: a faint track from this node to the next, and a fill
                  that follows the reader through this part's text. */}
              <span
                aria-hidden="true"
                className={`absolute left-[4px] top-[19px] w-px bg-white/10 ${isLast ? "bottom-0" : "-bottom-2.5"}`}
              />
              <motion.span
                aria-hidden="true"
                style={{ scaleY: fills[i] }}
                className={`absolute left-[4px] top-[19px] w-px origin-top bg-blue-400/70 ${isLast ? "bottom-0" : "-bottom-2.5"}`}
              />
              <span
                aria-hidden="true"
                className={`absolute left-0 top-[10px] h-[9px] w-[9px] rounded-full border transition-[background-color,border-color,box-shadow] duration-300 ${
                  state === "current"
                    ? "border-blue-400 bg-blue-400 shadow-[0_0_0_4px_rgb(125_160_215/0.16)]"
                    : state === "past"
                      ? "border-blue-400/60 bg-blue-400/60"
                      : "border-white/25 bg-black"
                }`}
              />

              <div className="flex items-start gap-1">
                <a
                  href={`#${p.anchorId}`}
                  onClick={(e) => onPlainClick(e, () => onJump(p.anchorId, { part: p.key, id: null }))}
                  aria-current={partActive ? "location" : undefined}
                  className="group relative block min-w-0 flex-1 rounded-md px-2 py-1.5 transition-transform active:scale-[0.99]"
                >
                  {partActive && <ActivePill reduce={reduce} />}
                  <time
                    dateTime={p.createdAt}
                    className="relative block font-mono text-[11px] leading-4 tabular-nums text-gray-400"
                  >
                    {formatPartTime(p.createdAt, p.timezone, entryDate)}
                  </time>
                  <span
                    className={`relative mt-0.5 line-clamp-2 text-[13px] leading-snug transition-colors ${
                      state === "current" ? "font-medium text-white" : "text-gray-300 group-hover:text-white"
                    }`}
                  >
                    {p.title}
                  </span>
                </a>
                {hasSections && (
                  <button
                    type="button"
                    onClick={() => onToggle(p.key)}
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-label={`${open ? "Hide" : "Show"} the ${p.sections.length} sections in ${p.title}`}
                    className="mt-1 flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 font-mono text-[11px] tabular-nums text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    {p.sections.length}
                    <Chevron open={open} />
                  </button>
                )}
              </div>

              {hasSections && (
                // grid-rows 0fr -> 1fr animates to the content's own height
                // without measuring it. `inert` while closed keeps the hidden
                // links out of the tab order and the accessibility tree.
                <div
                  id={listId}
                  inert={!open}
                  className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <ul className="pb-1.5 pt-0.5">
                      {p.sections.map((s) => {
                        const active = position.id === s.id;
                        return (
                          <li key={s.id}>
                            <a
                              href={`#${s.id}`}
                              onClick={(e) => onPlainClick(e, () => onJump(s.id, { part: p.key, id: s.id }))}
                              aria-current={active ? "location" : undefined}
                              title={s.text}
                              className={`relative block rounded-md py-1 pr-2 text-[13px] leading-snug transition-colors ${
                                s.depth === 2 ? "pl-5" : "pl-2"
                              } ${active ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
                            >
                              {active && <ActivePill reduce={reduce} />}
                              <span className="relative line-clamp-2">{s.text}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </LayoutGroup>
  );
}

/** Keeps the active row inside a scrollable list once the expand transition settles. */
function useKeepActiveInView(
  box: RefObject<HTMLElement | null>,
  position: Position,
  reduce: boolean,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => {
      const el = box.current;
      const row = el?.querySelector<HTMLElement>('[aria-current="location"]');
      if (!el || !row) return;
      const b = el.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (r.top < b.top + 24 || r.bottom > b.bottom - 32) {
        el.scrollTo({
          top: el.scrollTop + (r.top - b.top) - b.height / 3,
          behavior: reduce ? "auto" : "smooth",
        });
      }
    }, 320);
    return () => window.clearTimeout(t);
  }, [box, position, reduce, enabled]);
}

interface Props {
  parts: JournalTocPart[];
  /** The page's YYYY-MM-DD, so a part written after midnight shows its date. */
  entryDate: string;
  /** Whole-page reading time, the number the header's "N min read" shows. */
  minutes: number;
  /** The article; the mobile pill shows while it is on screen. */
  articleRef: RefObject<HTMLElement | null>;
}

/**
 * SHAN-571: table of contents for a journal date.
 *
 * Desktop: a sticky timeline rail in the right column. Below md: a floating
 * pill that names the section you are in and opens the same outline as a
 * bottom sheet. Both read one scroll spy, so they always agree.
 *
 * Client-only by construction: it renders after JournalEntryView's fetch, so
 * nothing here is in the server HTML and nothing here can mismatch it.
 */
export function JournalToc({ parts, entryDate, minutes, articleRef }: Props) {
  const { position, fills, overall, jump, reduce } = useReadingPosition(parts);

  // A part opened or closed by hand stays that way until the reader moves into
  // another part; then the outline follows them again.
  const [manual, setManual] = useState<{ part: string | null; open: Record<string, boolean> }>({
    part: null,
    open: {},
  });
  const choices = manual.part === position.part ? manual.open : {};
  const isOpen = (key: string) => choices[key] ?? key === position.part;
  const toggle = (key: string) =>
    setManual({ part: position.part, open: { ...choices, [key]: !isOpen(key) } });

  const railScroll = useRef<HTMLDivElement>(null);
  useKeepActiveInView(railScroll, position, reduce);

  // ---- mobile ----
  const [sheetOpen, setSheetOpen] = useState(false);
  const [articleOnScreen, setArticleOnScreen] = useState(false);
  const sheetScroll = useRef<HTMLDivElement>(null);
  const pending = useRef<{ anchorId: string; next: Position } | null>(null);
  const close = () => setSheetOpen(false);
  useScrollLock(sheetOpen);
  useEscapeKey(close, sheetOpen);
  useKeepActiveInView(sheetScroll, position, true, sheetOpen);

  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setArticleOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [articleRef]);

  // A row tapped in the sheet scrolls once the sheet has closed and released the
  // scroll lock; scrolling a page that is still overflow:hidden does nothing.
  useEffect(() => {
    if (sheetOpen || !pending.current) return;
    const { anchorId, next } = pending.current;
    pending.current = null;
    jump(anchorId, next);
  }, [sheetOpen, jump]);

  const activePart = parts.find((p) => p.key === position.part) ?? parts[0];
  const activeIndex = Math.max(0, parts.indexOf(activePart));
  const activeSection = activePart?.sections.find((s) => s.id === position.id);
  const label = activeSection?.text ?? activePart?.title ?? "Contents";
  const ringFill = useTransform(
    overall,
    (p) =>
      `conic-gradient(var(--color-blue-400) ${Math.round(p * 360)}deg, rgb(255 255 255 / 0.1) 0deg)`
  );

  const listProps = { parts, entryDate, position, fills, isOpen, onToggle: toggle, reduce };

  const mobile = (
    <>
      <AnimatePresence>
        {articleOnScreen && (
          <motion.button
            key="pill"
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            aria-label={`Contents. Reading: ${label}`}
            initial={reduce ? false : { y: 96 }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: 96 }}
            transition={SPRING}
            className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-full border border-white/10 bg-gray-950/85 py-1.5 pl-1.5 pr-4 text-left shadow-[0_16px_40px_rgb(0_0_0/0.45)] backdrop-blur-xl transition-[scale] active:scale-[0.98] md:hidden print:hidden"
          >
            <motion.span
              aria-hidden="true"
              style={{ background: ringFill }}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full"
            >
              <span className="absolute inset-[3px] rounded-full bg-gray-950" />
              <span className="relative font-mono text-[10px] tabular-nums text-gray-300">
                {activeIndex + 1}/{parts.length}
              </span>
            </motion.span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-mono text-[10px] leading-4 text-gray-400">
                <span>
                  {activePart ? formatPartTime(activePart.createdAt, activePart.timezone, entryDate) : ""}
                </span>
                <span aria-hidden="true">·</span>
                <MinutesLeft overall={overall} minutes={minutes} />
              </span>
              <span className="relative block h-5 overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={label}
                    initial={reduce ? false : { y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { y: -14, opacity: 0 }}
                    transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
                    className="block truncate text-[13px] leading-5 text-white"
                  >
                    {label}
                  </motion.span>
                </AnimatePresence>
              </span>
            </span>
            <span
              aria-hidden="true"
              className="h-[6px] w-[6px] shrink-0 translate-y-0.5 rotate-[-135deg] border-b border-r border-gray-400"
            />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            key="sheet"
            className="fixed inset-0 z-50 md:hidden print:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={close} aria-hidden="true" />
            <motion.div
              className="absolute inset-x-0 bottom-0"
              initial={reduce ? false : { y: "100%" }}
              animate={{ y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "100%" }}
              transition={SPRING}
            >
              <FocusTrappedDiv
                role="dialog"
                aria-modal="true"
                aria-labelledby="journal-toc-sheet-title"
                className="flex max-h-[80dvh] flex-col rounded-t-2xl border-t border-white/10 bg-gray-950 shadow-[0_-24px_60px_rgb(0_0_0/0.5)]"
              >
                <div className="px-4 pt-3">
                  <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-white/15" />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <h2 id="journal-toc-sheet-title" className="text-sm font-medium text-white">
                      Contents
                    </h2>
                    <MinutesLeft
                      overall={overall}
                      minutes={minutes}
                      className="ml-auto font-mono text-[11px] tabular-nums text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={close}
                      className="inline-flex min-h-8 items-center rounded-md bg-white/5 px-3 text-xs text-gray-300 transition-colors hover:bg-white/10 active:scale-[0.98]"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div
                  ref={sheetScroll}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3"
                >
                  <nav aria-label="Entry contents">
                    <TocList
                      {...listProps}
                      instance="sheet"
                      onJump={(anchorId, next) => {
                        pending.current = { anchorId, next };
                        close();
                      }}
                    />
                  </nav>
                </div>
              </FocusTrappedDiv>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <>
      <nav
        id="journal-toc"
        aria-label="Entry contents"
        className="sticky top-under-header hidden max-h-[calc(100dvh-3rem-var(--site-header-offset))] flex-col transition-[top] duration-[420ms] ease-[var(--ease-glide)] motion-reduce:transition-none md:flex print:hidden"
      >
        <div className="mb-1 flex items-baseline justify-between gap-3">
          {/* A <p>, not a heading, for the reason PostToc gives: the entry's own
              sections are the headings, and the nav's aria-label names it. */}
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Contents</p>
          <MinutesLeft
            overall={overall}
            minutes={minutes}
            className="font-mono text-[11px] tabular-nums text-gray-400"
          />
        </div>
        <div
          ref={railScroll}
          className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-2 [mask-image:linear-gradient(to_bottom,transparent,#000_10px,#000_calc(100%-28px),transparent)] [scrollbar-color:rgb(255_255_255/0.12)_transparent] [scrollbar-width:thin]"
        >
          <TocList {...listProps} instance="rail" onJump={jump} />
        </div>
      </nav>
      {typeof document !== "undefined" ? createPortal(mobile, document.body) : null}
    </>
  );
}
