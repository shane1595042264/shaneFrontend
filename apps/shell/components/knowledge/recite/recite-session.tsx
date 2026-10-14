"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { responsiveTableComponents } from "@/lib/markdown-table";
import {
  deleteEntry,
  submitRecital,
  type KnowledgeEntry,
  type ReciteHint,
} from "@/lib/knowledge-api";

export type OutcomeKind = "memorized" | "skipped" | "deleted";

export interface ReciteOutcome {
  id: string;
  word: string;
  status: OutcomeKind;
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
/** Past this many cards the progress strip is one bar; segments would be hairlines. */
const MAX_SEGMENTS = 40;

interface Custom {
  kind: OutcomeKind;
  reduce: boolean;
}

// Each way a card can leave says what happened to it: a memorized card lifts
// away, a skipped one is flicked aside the way a swipe would send it, a deleted
// one shrinks out. The next card rises out of the stack behind it.
const cardVariants = {
  initial: (c: Custom) => (c.reduce ? { opacity: 0 } : { y: 24, scale: 0.96, opacity: 0 }),
  animate: {
    y: 0,
    x: 0,
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 32 },
  },
  exit: (c: Custom) =>
    c.reduce
      ? { opacity: 0, transition: { duration: 0.15 } }
      : c.kind === "memorized"
        ? { y: -56, scale: 0.97, opacity: 0, transition: { duration: 0.38, ease: EASE_OUT_EXPO } }
        : c.kind === "deleted"
          ? { scale: 0.9, opacity: 0, transition: { duration: 0.26, ease: EASE_OUT_EXPO } }
          : { x: -180, rotate: -5, opacity: 0, transition: { duration: 0.32, ease: EASE_OUT_EXPO } },
};

/**
 * SHAN-575: one sitting of recite. A stack of cards walked in the order the
 * deck arrived (the server shuffled it), each resolved as memorized, skipped or
 * deleted. Story-style progress across the top so the length of the sitting is
 * always visible, the way a run of notes or instants is.
 */
export function ReciteSession({
  location,
  cards,
  onDone,
}: {
  location: string;
  cards: KnowledgeEntry[];
  onDone: (outcomes: ReciteOutcome[]) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<ReciteOutcome[]>([]);
  const [lastKind, setLastKind] = useState<OutcomeKind>("skipped");
  const card = cards[index];

  // Keyed on the card so a key press landing on the outgoing card while it
  // animates away cannot resolve the next one too.
  const resolve = useCallback(
    (id: string, kind: OutcomeKind) => {
      if (!card || id !== card.id) return;
      const next = [...outcomes, { id: card.id, word: card.word, status: kind }];
      setLastKind(kind);
      setOutcomes(next);
      if (index + 1 >= cards.length) onDone(next);
      else setIndex(index + 1);
    },
    [card, cards.length, index, onDone, outcomes]
  );

  const end = () => onDone(outcomes);
  const left = cards.length - index;

  return (
    <section className="pt-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <button
          type="button"
          onClick={end}
          className="text-gray-400 transition-colors hover:text-white"
        >
          &larr; End
        </button>
        <p className="text-gray-400">
          At <span className="text-white">{location}</span>
        </p>
        <p className="font-mono text-xs tabular-nums text-gray-400" aria-live="polite">
          {Math.min(index + 1, cards.length)} / {cards.length}
        </p>
      </div>

      <Progress total={cards.length} outcomes={outcomes} current={index} />

      <div className="relative mx-auto mt-10 max-w-xl pb-10">
        {/* The rest of the deck, peeking out from under the card in play. */}
        {left > 2 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-10 bottom-0 top-10 rounded-[1.25rem] border border-white/[0.04] bg-white/[0.012]"
          />
        )}
        {left > 1 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-5 bottom-5 top-5 rounded-[1.25rem] border border-white/[0.06] bg-gray-950/80"
          />
        )}
        <AnimatePresence mode="popLayout" initial={false} custom={{ kind: lastKind, reduce }}>
          {card && (
            <motion.div
              key={card.id}
              custom={{ kind: lastKind, reduce }}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative z-10"
            >
              <ReciteCard card={card} location={location} onResolve={resolve} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 hidden items-center justify-center gap-6 text-xs text-gray-400 md:flex">
        <span>
          <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd> check
        </span>
        <span>
          <Kbd>Esc</Kbd> then <Kbd>F</Kbd> flip
        </span>
        <span>
          <Kbd>&rarr;</Kbd> skip
        </span>
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-gray-300">
      {children}
    </kbd>
  );
}

function Progress({
  total,
  outcomes,
  current,
}: {
  total: number;
  outcomes: ReciteOutcome[];
  current: number;
}) {
  const tone = (status: OutcomeKind | "current" | "ahead") =>
    status === "memorized"
      ? "bg-teal-300/90"
      : status === "skipped"
        ? "bg-white/35"
        : status === "deleted"
          ? "bg-white/[0.12]"
          : status === "current"
            ? "bg-white/70"
            : "bg-white/[0.08]";

  if (total > MAX_SEGMENTS) {
    const memorized = outcomes.filter((o) => o.status === "memorized").length;
    const rest = outcomes.length - memorized;
    return (
      <div aria-hidden="true" className="mt-4 flex h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
        <div className="bg-teal-300/90 transition-[width] duration-500" style={{ width: `${(memorized / total) * 100}%` }} />
        <div className="bg-white/35 transition-[width] duration-500" style={{ width: `${(rest / total) * 100}%` }} />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="mt-4 flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${tone(
            outcomes[i]?.status ?? (i === current ? "current" : "ahead")
          )}`}
        />
      ))}
    </div>
  );
}

/** Brackets, semicolons, pipes or arrows: an example that is code reads better in mono. */
function looksLikeCode(text: string): boolean {
  return /[{}();|]|=>|::|\$ /.test(text);
}

const faceClass =
  "relative flex min-w-0 flex-col rounded-[1.25rem] border bg-gray-950 p-6 [overflow-wrap:anywhere] shadow-[0_40px_90px_-40px_rgb(0_0_0/0.9)] [backface-visibility:hidden] [grid-area:1/1] md:p-8";

const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm transition-[background-color,color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const quiet = `${buttonClass} text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/[0.06] hover:text-white`;
const primary = `${buttonClass} bg-white px-5 font-medium text-black hover:bg-gray-200 disabled:bg-white/10 disabled:text-gray-400`;

/**
 * One card, two faces. The recite face holds the prompt and the box you type
 * into; the answer face holds the definition. They are the two sides of one
 * 3D card, and whichever side is turned away is `inert`, so you can flip to
 * look at the answer whenever you like but cannot be typing while it is in
 * view. The typed text survives the flip.
 */
function ReciteCard({
  card,
  location,
  onResolve,
}: {
  card: KnowledgeEntry;
  location: string;
  onResolve: (id: string, kind: OutcomeKind) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const [answer, setAnswer] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [hints, setHints] = useState<ReciteHint[]>([]);
  const [miss, setMiss] = useState<string | null>(null);
  const [passed, setPassed] = useState<{ feedback: string; memorizedAt: string } | null>(null);
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const resolved = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const flipButton = useRef<HTMLButtonElement>(null);
  const shake = useAnimationControls();
  const drag = useDragControls();

  const done = useCallback(
    (kind: OutcomeKind) => {
      if (resolved.current) return;
      resolved.current = true;
      onResolve(card.id, kind);
    },
    [card.id, onResolve]
  );

  // Typing first on a keyboard; on a phone, let the reader see the card before
  // the keyboard takes half the screen.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) textarea.current?.focus();
  }, []);

  // Focus follows the face that is showing, because the other one is inert.
  const firstFlip = useRef(true);
  useEffect(() => {
    if (firstFlip.current) {
      firstFlip.current = false;
      return;
    }
    if (flipped) (passed ? nextButton.current : flipButton.current)?.focus();
    else textarea.current?.focus();
  }, [flipped, passed]);

  const check = useCallback(async () => {
    const text = answer.trim();
    if (!text || checking || passed || resolved.current) return;
    setChecking(true);
    setError(null);
    try {
      const result = await submitRecital(card.id, { location, answer: text, attempt: attempts + 1 });
      setAttempts((n) => n + 1);
      setOffline(result.judge === "similarity");
      if (result.correct) {
        setMiss(null);
        setPassed({ feedback: result.feedback, memorizedAt: result.memorizedAt });
        setFlipped(true);
      } else {
        setMiss(result.feedback);
        const hint = result.hint;
        if (hint) setHints((prev) => (prev.some((h) => h.kind === hint.kind) ? prev : [...prev, hint]));
        if (!reduce) void shake.start({ x: [0, -9, 8, -5, 3, 0], transition: { duration: 0.42 } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't grade that");
    } finally {
      setChecking(false);
    }
  }, [answer, attempts, card.id, checking, location, passed, reduce, shake]);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteEntry(card.id);
      done("deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this card");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (resolved.current || confirmDelete) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT");
      if (typing) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void check();
        } else if (e.key === "Escape") {
          t.blur();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        done(passed ? "memorized" : "skipped");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [check, confirmDelete, done, passed]);

  // A flick to the left sends the card on, like swiping past a story. Only the
  // top of the card is a handle, so selecting text and typing never drag.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -110 || info.velocity.x < -650) done(passed ? "memorized" : "skipped");
  };
  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!reduce) drag.start(e);
    },
    className: "touch-pan-y cursor-grab select-none active:cursor-grabbing",
  };

  const labels = (card.labels ?? []).slice(0, 2);

  return (
    <motion.div
      drag="x"
      dragListener={false}
      dragControls={drag}
      dragSnapToOrigin
      dragElastic={0.5}
      onDragEnd={onDragEnd}
      animate={shake}
      className="[perspective:1800px]"
    >
      <motion.div
        className="grid grid-cols-1 [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 26 }}
      >
        {/* ---------- recite face ---------- */}
        <div
          inert={flipped}
          aria-hidden={flipped}
          className={`${faceClass} border-white/[0.09] bg-[linear-gradient(180deg,rgb(255_255_255/0.035),transparent_45%)]`}
        >
          <div {...handle}>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="font-medium capitalize text-gray-300">{card.category}</span>
              {labels.map((l) => (
                <span key={l}>#{l}</span>
              ))}
            </div>
            <h3
              id={`recite-prompt-${card.id}`}
              className="mt-6 break-words text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-white md:text-[40px]"
            >
              {card.word}
            </h3>
            {card.pronunciation && <p className="mt-2 font-mono text-sm text-gray-400">{card.pronunciation}</p>}
          </div>

          <label htmlFor={`recite-answer-${card.id}`} className="sr-only">
            Recite {card.word} from memory
          </label>
          <textarea
            ref={textarea}
            id={`recite-answer-${card.id}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={5000}
            rows={3}
            placeholder="Type it from memory"
            disabled={!!passed}
            className="mt-8 block max-h-[40vh] min-h-[5.5rem] w-full resize-none border-b border-white/10 bg-transparent pb-3 text-lg leading-relaxed text-white outline-none transition-colors [field-sizing:content] placeholder:text-gray-400 focus:border-white/30"
          />

          <AnimatePresence initial={false}>
            {hints.map((h) => (
              <motion.div
                key={h.kind}
                initial={reduce ? false : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                className="mt-3 rounded-xl bg-amber-300/[0.06] px-4 py-3 ring-1 ring-inset ring-amber-200/15"
              >
                <p className="text-xs font-medium text-amber-200/90">{h.label}</p>
                <p
                  className={`mt-1 break-words text-[15px] leading-relaxed text-gray-100 ${
                    h.kind === "shape" || (h.kind === "example" && looksLikeCode(h.text))
                      ? "font-mono text-sm tracking-wide"
                      : ""
                  }`}
                >
                  {h.text}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>

          <div aria-live="polite" className="min-h-6 pb-4 pt-4 text-sm leading-relaxed">
            {miss && <p className="text-amber-100/90">{miss}</p>}
            {error && <p className="text-red-300">{error}</p>}
            {offline && !error && (
              <p className="mt-1 font-mono text-[11px] text-gray-400">AI grader unavailable, graded by similarity.</p>
            )}
          </div>

          {confirmDelete ? (
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-500/[0.07] px-4 py-3 ring-1 ring-inset ring-red-400/20">
              <p className="text-sm text-red-100">Delete {card.word} for good?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className={quiet}>
                  Keep
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleting}
                  className={`${buttonClass} bg-red-500/90 font-medium text-white hover:bg-red-500`}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              <button type="button" onClick={() => setFlipped(true)} className={quiet}>
                Show answer
              </button>
              <button type="button" onClick={() => done("skipped")} className={quiet}>
                Skip
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={`${buttonClass} text-gray-400 hover:bg-red-500/10 hover:text-red-300`}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => void check()}
                disabled={!answer.trim() || checking}
                className={`${primary} ml-auto`}
              >
                {checking ? "Checking..." : "Check"}
              </button>
            </div>
          )}
        </div>

        {/* ---------- answer face ---------- */}
        <div
          inert={!flipped}
          aria-hidden={!flipped}
          className={`${faceClass} [transform:rotateY(180deg)] ${
            passed
              ? "border-teal-300/25 bg-[linear-gradient(180deg,rgb(45_212_191/0.07),transparent_50%)]"
              : "border-white/[0.09] bg-[linear-gradient(180deg,rgb(255_255_255/0.035),transparent_45%)]"
          }`}
        >
          <div {...handle} className={`${handle.className} flex items-center justify-between gap-3`}>
            {passed ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-200 ring-1 ring-inset ring-teal-300/25">
                Memorized at {passed.memorizedAt}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Answer</span>
            )}
            <span className="truncate text-xs text-gray-400">{card.word}</span>
          </div>

          <div className="prose prose-invert mt-6 max-w-none break-words text-[17px] leading-relaxed prose-p:my-3 prose-a:text-blue-300 prose-code:text-[0.9em]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={responsiveTableComponents}>
              {card.definition ?? ""}
            </ReactMarkdown>
          </div>
          {card.exampleSentence && (
            <p
              className={`mt-5 break-words rounded-xl bg-white/[0.04] px-4 py-3 leading-relaxed text-gray-300 ${
                looksLikeCode(card.exampleSentence) ? "font-mono text-sm" : "text-[15px] italic"
              }`}
            >
              {card.exampleSentence}
            </p>
          )}

          {passed && (
            <div className="mt-6 border-t border-white/[0.07] pt-4">
              <p className="text-xs text-gray-400">You wrote</p>
              <p className="mt-1 break-words text-[15px] italic leading-relaxed text-gray-300">{answer.trim()}</p>
              <p className="mt-3 text-sm text-teal-100/90">{passed.feedback}</p>
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
            {passed ? (
              <button ref={nextButton} type="button" onClick={() => done("memorized")} className={`${primary} ml-auto`}>
                Next
              </button>
            ) : (
              <button ref={flipButton} type="button" onClick={() => setFlipped(false)} className={`${primary} ml-auto`}>
                Back to reciting
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
