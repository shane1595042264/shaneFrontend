"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import Link from "@/components/transition-link";
import type { KnowledgeTerm } from "@/lib/knowledge-terms";
import { place, type Box } from "@/lib/popover-place";
import type { TermMarks } from "@/lib/rehype-term-marks";

/**
 * SHAN-712: words that have a knowledge card, underlined wherever the site's
 * prose mentions them (journal, blog, course pages, lesson cards), the way a
 * Confluence glossary links its terms. Clicking one opens the card's
 * definition, a link to the whole card, and Explain here, which asks the
 * reader's own AI key about the word in this sentence (the same Explain as
 * selecting it by hand, and saved as a note the same way).
 *
 * NotesProvider owns all of it: it loads the index, holds which term is open
 * and renders the popover, because it already sits around every surface that
 * renders notes and it owns Explain. This file only has the pieces it hands
 * out, so there is no import cycle with inline-notes.
 */

export type { TermMarks };

export interface TermUi {
  openId: string | null;
  open: (id: string, el: HTMLElement, opts: { clientY?: number; viaKeyboard?: boolean }) => void;
}

const NO_TERMS: TermMarks = { index: null, exclude: null };
const TermMarksContext = createContext<TermMarks>(NO_TERMS);
const TermUiContext = createContext<TermUi | null>(null);

/**
 * Two contexts for the same reason NotesProvider has two: bodies read the
 * marks, which change once (when the index loads), and only the marks read
 * which term is open, which changes on every click.
 */
export function TermProviders({ marks, ui, children }: { marks: TermMarks; ui: TermUi; children: ReactNode }) {
  return (
    <TermMarksContext.Provider value={marks}>
      <TermUiContext.Provider value={ui}>{children}</TermUiContext.Provider>
    </TermMarksContext.Provider>
  );
}

/** What a markdown body passes to rehypeTermMarks. Stable until the index loads. */
export function useTermMarks(): TermMarks {
  return useContext(TermMarksContext);
}

/** The span react-markdown renders for a term (the <dfn> lib/rehype-term-marks emits). */
export function TermMark({ node, children, ...rest }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) {
  const ui = useContext(TermUiContext);
  const id = ((rest as Record<string, unknown>)["data-term-id"] ??
    (node as { properties?: Record<string, unknown> } | undefined)?.properties?.dataTermId ??
    "") as string;
  if (!ui || !id) return <span>{children}</span>;
  const active = ui.openId === id;
  return (
    <span
      data-term-id={id}
      data-active={active ? "" : undefined}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={active}
      className="term-mark"
      onClick={(e) => {
        // A drag that started on a term is a selection (for Add note or
        // Explain on more words), not a click.
        if (window.getSelection()?.isCollapsed === false) return;
        ui.open(id, e.currentTarget, { clientY: e.clientY });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          ui.open(id, e.currentTarget, { viaKeyboard: true });
        }
      }}
    >
      {children}
    </span>
  );
}

const SPRING = { type: "spring", stiffness: 460, damping: 34, mass: 0.7 } as const;

export function TermPopover({
  open,
  canExplain,
  onExplain,
  onClose,
}: {
  open: { term: KnowledgeTerm; box: Box; viaKeyboard: boolean; el: HTMLElement } | null;
  /** Signed in: Explain here runs on the reader's own key. */
  canExplain: boolean;
  onExplain: () => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const firstAction = useRef<HTMLElement | null>(null);
  const [height, setHeight] = useState(180);

  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight);
  });

  useEffect(() => {
    if (!open) return;
    if (open.viaKeyboard) firstAction.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (ref.current?.contains(t) || t?.closest?.("[data-term-id]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Ours, not the lesson player's: it stands down while a
      // [data-notes-popover] is up, so Escape closes this and not the lesson.
      e.stopPropagation();
      onClose();
      if (open.viaKeyboard) open.el.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const width = typeof document === "undefined" ? 340 : Math.min(340, document.documentElement.clientWidth - 32);
  const pos = open ? place(open.box, width, height) : null;
  const term = open?.term;
  const cardHref = term ? `/knowledge?entry=${encodeURIComponent(term.id)}` : "";
  // The knowledge browser reads ?entry= on load and on Back, not on a client
  // navigation to the page it is already on, so from there go the long way.
  const onKnowledgePage = typeof window !== "undefined" && window.location.pathname === "/knowledge";
  const meta = term ? [term.partOfSpeech, term.pronunciation].filter(Boolean).join(" · ") : "";
  // A card whose word is a whole sentence ("SSRF: SSRF stands for ...") was
  // matched by its short label; title it by that, not by the sentence.
  const title = term ? (term.word.length > 48 ? term.match[0] : term.word) : "";

  return (
    <AnimatePresence>
      {open && term && pos && (
        <motion.div
          key={term.id}
          ref={ref}
          role="dialog"
          aria-label={`${title}, from the knowledge base`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: pos.above ? 8 : -8, scale: 0.96, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: pos.above ? 4 : -4, scale: 0.98, transition: { duration: 0.14 } }}
          transition={SPRING}
          style={{
            position: "absolute",
            left: pos.left,
            top: pos.top,
            width,
            transformOrigin: `${pos.originX}px ${pos.above ? "100%" : "0%"}`,
          }}
          data-notes-popover=""
          className="z-[70] max-h-[min(24rem,70vh)] overflow-y-auto overscroll-contain rounded-2xl bg-gray-950/90 shadow-[0_28px_70px_-18px_rgb(0_0_0/0.85)] ring-1 ring-white/[0.12] backdrop-blur-xl print:hidden"
        >
          <div aria-hidden="true" className="term-rule" />
          <div className="p-4">
            <p className="text-xs text-gray-400">
              Knowledge <span aria-hidden="true">·</span> {term.category}
            </p>
            <p className="mt-1.5 text-[15px] font-semibold leading-snug text-white">
              {title}
              {meta ? <span className="ml-2 text-sm font-normal text-gray-400">{meta}</span> : null}
            </p>
            <div className="mt-2 text-sm leading-6 text-gray-300">
              <ReactMarkdown
                allowedElements={["p", "em", "strong", "code"]}
                unwrapDisallowed
                components={{
                  p: ({ children }) => <p>{children}</p>,
                  code: ({ children }) => (
                    <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[0.9em] text-gray-100">{children}</code>
                  ),
                }}
              >
                {term.definition}
              </ReactMarkdown>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {canExplain && (
                <button
                  ref={(el) => {
                    firstAction.current = el;
                  }}
                  type="button"
                  onClick={onExplain}
                  className="note-explain-btn inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 text-sm text-gray-100 transition-colors hover:bg-white/[0.13]"
                >
                  <span aria-hidden="true" className="note-spark text-amber-200">
                    {"✦"}
                  </span>
                  Explain here
                </button>
              )}
              {onKnowledgePage ? (
                <a
                  ref={(el) => {
                    if (!canExplain) firstAction.current = el;
                  }}
                  href={cardHref}
                  className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-teal-300 transition-colors hover:bg-white/[0.06] hover:text-teal-200"
                >
                  Open card <span aria-hidden="true">&nbsp;&rarr;</span>
                </a>
              ) : (
                <Link
                  ref={(el: HTMLAnchorElement | null) => {
                    if (!canExplain) firstAction.current = el;
                  }}
                  href={cardHref}
                  onClick={onClose}
                  className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-teal-300 transition-colors hover:bg-white/[0.06] hover:text-teal-200"
                >
                  Open card <span aria-hidden="true">&nbsp;&rarr;</span>
                </Link>
              )}
            </div>
            {canExplain && <p className="mt-2 text-xs leading-5 text-gray-400">Explain here asks your AI key about the word in this sentence.</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
