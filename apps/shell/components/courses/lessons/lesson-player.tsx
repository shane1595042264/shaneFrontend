"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { useScrollLock } from "@/lib/use-scroll-lock";
import {
  gradeBlank,
  gradeChoice,
  gradeOrder,
  isGraded,
  type CourseLesson,
  type CourseStep,
  type LessonRun,
} from "@/lib/course-lessons";
import {
  BlankExercise,
  ChoiceExercise,
  MatchExercise,
  OrderExercise,
  isTyping,
  type ExerciseStatus,
  type MatchValue,
} from "./exercises";
import { CodeBlock, LessonText } from "./lesson-text";
import { Kbd, ShortcutSheet } from "./shortcut-sheet";

/**
 * SHAN-652. One lesson, one card at a time, Duolingo-shaped: answer, Check,
 * read the feedback, Continue. A step missed the first time comes back once
 * at the end of the lesson, and the score is the share of exercises answered
 * right on the first try, so the retry teaches without inflating the number.
 *
 * SHAN-659: the whole run works from the keyboard (answer keys live in
 * exercises.tsx; Enter, Escape and ? here), and the place is handed to
 * `onProgress` after every card, so leaving costs nothing and Escape quits at
 * once. A `resume` run picks up on the card it stopped at.
 */

export type SaveState = "saving" | "saved" | "local" | "preview" | "failed";

interface Props {
  lesson: CourseLesson;
  unitTitle: string;
  position: { index: number; total: number };
  next: { title: string } | null;
  onExit: () => void;
  onNext: () => void;
  /** Called once when the last card is done; resolves to where it was saved. */
  onFinish: (score: number) => Promise<SaveState>;
  /** A run left halfway, to pick up instead of starting at card one. */
  resume?: LessonRun | null;
  /** The place after each card, to be offered back as `resume`. */
  onProgress?: (run: LessonRun) => void;
  /** Throw the saved place away and start the lesson from card one. */
  onRestart?: () => void;
}

const EMPTY_MATCH: MatchValue = { matched: [], mistakes: 0 };
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const ease = [0.16, 1, 0.3, 1] as const;

function kicker(step: CourseStep): string {
  switch (step.type) {
    case "teach":
      return "Read this";
    case "choice":
      return step.choices.filter((c) => c.correct).length > 1 ? "Choose every right answer" : "Choose the answer";
    case "blank":
      return step.bank ? "Complete the sentence" : "Type the missing words";
    case "order":
      return "Put these in order";
    case "match":
      return "Match the pairs";
  }
}

function heading(step: CourseStep): string | null {
  switch (step.type) {
    case "teach":
      return step.title ?? null;
    case "choice":
    case "order":
      return step.prompt;
    case "blank":
    case "match":
      return step.prompt ?? null;
  }
}

function filledSentence(text: string): string {
  return text.replace(/\[\[([^\[\]]+)\]\]/g, (_, a: string) => a.split("|")[0].trim());
}

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LessonPlayer({
  lesson,
  unitTitle,
  position,
  next,
  onExit,
  onNext,
  onFinish,
  resume,
  onProgress,
  onRestart,
}: Props) {
  useScrollLock(true);
  const reduce = useReducedMotion() ?? false;
  const steps = lesson.steps;
  const graded = useMemo(() => steps.filter(isGraded).length, [steps]);

  const [queue, setQueue] = useState<number[]>(() => resume?.queue ?? steps.map((_, i) => i));
  const [pos, setPos] = useState(resume?.pos ?? 0);
  const [status, setStatus] = useState<ExerciseStatus>("idle");
  const [choice, setChoice] = useState<number[]>([]);
  const [blank, setBlank] = useState<string[]>([]);
  const [blankResults, setBlankResults] = useState<boolean[] | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [match, setMatch] = useState<MatchValue>(EMPTY_MATCH);
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>(() => resume?.firstTry ?? {});
  const [requeued, setRequeued] = useState<Set<number>>(() => new Set(resume?.requeued ?? []));
  const [resolved, setResolved] = useState(resume?.resolved ?? 0);
  const [streak, setStreak] = useState(resume?.streak ?? 0);
  const [finished, setFinished] = useState<{ score: number; ms: number } | null>(null);
  const [save, setSave] = useState<SaveState>("saving");
  const [sheet, setSheet] = useState(false);
  const resumedAt = useRef(resume ? resume.pos : null);
  const startedAt = useRef(Date.now() - (resume?.elapsedMs ?? 0));
  const promptRef = useRef<HTMLHeadingElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Its own focus trap rather than FocusTrappedDiv, which focuses the first
  // button on open: here that is Close, and Enter would quit the lesson. Focus
  // starts on the card instead (StepCard) and returns where it was on close.
  // Read during the first render: by the time this component's effects run,
  // StepCard's (a child's, so earlier) has already moved focus to the card,
  // and focus would "return" to a heading that is about to unmount (SHAN-659).
  const [returnTo] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => () => returnTo?.focus?.({ preventScroll: true }), [returnTo]);

  const idx = queue[pos];
  const step = steps[idx];
  const isRetry = pos >= steps.length;
  const seed = `${lesson.id}:${idx}:${isRetry ? "r" : "a"}`;

  const ready = (() => {
    if (!step) return false;
    switch (step.type) {
      case "teach":
        return true;
      case "choice":
        return choice.length > 0;
      case "blank":
        return blank.length > 0 && blank.every((b) => b.trim().length > 0) && blank.length === (step.text.match(/\[\[[^\[\]]+\]\]/g)?.length ?? 0);
      case "order":
        return order.length === step.items.length;
      case "match":
        return match.matched.length === step.pairs.length;
    }
  })();

  const finish = useCallback(
    (first: Record<number, boolean>) => {
      const right = Object.values(first).filter(Boolean).length;
      const score = graded === 0 ? 100 : Math.round((100 * right) / graded);
      setFinished({ score, ms: Date.now() - startedAt.current });
      setSave("saving");
      onFinish(score)
        .then(setSave)
        .catch(() => setSave("failed"));
    },
    [graded, onFinish],
  );

  const check = useCallback(() => {
    if (!step || step.type === "teach" || status !== "idle" || !ready) return;
    let correct = false;
    if (step.type === "choice") correct = gradeChoice(step, choice);
    else if (step.type === "blank") {
      const r = gradeBlank(step, blank);
      setBlankResults(r);
      correct = r.every(Boolean);
    } else if (step.type === "order") correct = gradeOrder(step, order);
    else if (step.type === "match") correct = match.mistakes === 0;

    setFirstTry((f) => (idx in f ? f : { ...f, [idx]: correct }));
    setStatus(correct ? "correct" : "wrong");
    setStreak((s) => (correct ? s + 1 : 0));
    if (correct) setResolved((r) => r + 1);
    else if (!requeued.has(idx)) {
      setRequeued((q) => new Set(q).add(idx));
      setQueue((q) => [...q, idx]);
    } else setResolved((r) => r + 1); // second miss: show the answer and move on
  }, [step, status, ready, choice, blank, order, match, idx, requeued]);

  const advance = useCallback(() => {
    if (!step) return;
    if (step.type === "teach") setResolved((r) => r + 1);
    if (pos + 1 >= queue.length) {
      finish(firstTry);
      return;
    }
    setPos(pos + 1);
    setStatus("idle");
    setChoice([]);
    setBlank([]);
    setBlankResults(null);
    setOrder([]);
    setMatch(EMPTY_MATCH);
  }, [step, pos, queue.length, finish, firstTry]);

  // Matching resolves itself: the last pair placed is the answer.
  useEffect(() => {
    if (step?.type === "match" && status === "idle" && match.matched.length === step.pairs.length) check();
  }, [step, status, match.matched.length, check]);

  // Hand the place up after every card. A checked card counts as done, so a
  // learner who leaves on the feedback comes back to the next card. Card one
  // untouched is not worth saving, and neither is the last card checked: the
  // next step there is the finish screen, which saves for real.
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  useEffect(() => {
    if (finished) return;
    const at = status === "idle" ? pos : pos + 1;
    if (at === 0 || at >= queue.length) return;
    progressRef.current?.({
      queue,
      pos: at,
      firstTry,
      requeued: [...requeued],
      resolved,
      streak,
      elapsedMs: Date.now() - startedAt.current,
    });
  }, [finished, status, pos, queue, firstTry, requeued, resolved, streak]);

  // Each new card starts at the top. Focus moves in StepCard's own mount
  // effect: with AnimatePresence the new card mounts only after the old one
  // has animated out, so focusing from here would hit the leaving card.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pos]);

  // After Check, Continue takes focus so Enter or Space moves on.
  useEffect(() => {
    if (status !== "idle") continueRef.current?.focus({ preventScroll: true });
  }, [status]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const root = rootRef.current;
      // SHAN-653: the notes layer (Add note, Explain) is portaled to <body>,
      // outside this dialog. Keys typed in a note, and Enter or Escape while
      // an explanation is open, belong to it: Escape closes the card, not the
      // lesson, and Enter does not check an answer behind it.
      const t = e.target;
      if (root && t instanceof Element && t !== document.body && !root.contains(t)) return;
      if (e.key !== "Tab" && document.querySelector("[data-notes-popover]")) return;
      if (sheet && e.key !== "Tab") {
        if (e.key === "Escape" || e.key === "?") {
          e.preventDefault();
          setSheet(false);
        }
        return;
      }
      if (e.key === "?" && !isTyping(e.target)) {
        e.preventDefault();
        setSheet(true);
        return;
      }
      if (e.key === "Tab" && root) {
        const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!root.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }
      if (e.key !== "Enter" || finished) return;
      // A focused button handles Enter itself; acting here too would double
      // it. Answer buttons are the exception: Enter checks, Space picks.
      if (e.target instanceof HTMLButtonElement) {
        if (!("answer" in e.target.dataset)) return;
        // Nothing picked yet: let Enter pick the focused answer.
        if (status === "idle" && !ready) return;
      }
      e.preventDefault();
      if (step?.type === "teach" || status !== "idle") advance();
      else check();
    },
    [sheet, finished, status, ready, onExit, step, advance, check],
  );

  // On the window, not the dialog: between cards focus can briefly sit on
  // <body>, and a React onKeyDown on the dialog would miss Enter there.
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const progress = Math.min(1, resolved / steps.length);
  const picked = step?.type === "choice" && choice.length === 1 ? step.choices[choice[0]] : null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${unitTitle}: ${lesson.title}`}
      className="fixed inset-0 z-[60] flex flex-col bg-black text-gray-100"
    >
      <header className="mx-auto flex h-16 w-full max-w-3xl shrink-0 items-center gap-4 px-4">
        <button
          type="button"
          onClick={onExit}
          aria-label={pos > 0 && !finished ? "Close lesson. Your place is saved" : "Close lesson"}
          aria-keyshortcuts="Escape"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-2xl leading-none text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <span aria-hidden="true">&times;</span>
        </button>
        <div
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((finished ? 1 : progress) * 100)}
          className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]"
        >
          <div
            className="absolute inset-0 origin-left rounded-full bg-teal-400 transition-transform duration-500"
            style={{ transform: `scaleX(${finished ? 1 : progress})` }}
          />
        </div>
        {resumedAt.current !== null && onRestart && !finished && (
          <button
            type="button"
            onClick={onRestart}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Start over
          </button>
        )}
        <button
          type="button"
          onClick={() => setSheet(true)}
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="?"
          className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-sm text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white [@media(pointer:fine)]:grid"
        >
          ?
        </button>
        <span
          aria-live="polite"
          className={`w-20 shrink-0 text-right text-sm tabular-nums transition-opacity duration-300 ${
            streak >= 2 && !finished ? "text-teal-300 opacity-100" : "opacity-0"
          }`}
        >
          {streak >= 2 && !finished ? `${streak} in a row` : ""}
        </span>
      </header>

      {finished ? (
        <FinishScreen
          lesson={lesson}
          score={finished.score}
          ms={finished.ms}
          graded={graded}
          firstTry={firstTry}
          save={save}
          position={position}
          next={next}
          onNext={onNext}
          onExit={onExit}
          onRetrySave={() => {
            setSave("saving");
            onFinish(finished.score)
              .then(setSave)
              .catch(() => setSave("failed"));
          }}
        />
      ) : (
        <>
          <div ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6 md:pt-12">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${pos}-${idx}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: -28 }}
                  transition={{ duration: reduce ? 0.12 : 0.3, ease }}
                >
                  {step && (
                    <StepCard
                      step={step}
                      noteKey={`${lesson.id}.${idx}`}
                      promptRef={promptRef}
                      isRetry={isRetry}
                      lessonTitle={lesson.title}
                    >
                      <motion.div
                        animate={status === "wrong" && !reduce ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        {step.type === "choice" && (
                          <ChoiceExercise step={step} value={choice} onChange={setChoice} status={status} />
                        )}
                        {step.type === "blank" && (
                          <BlankExercise
                            step={step}
                            value={blank}
                            onChange={setBlank}
                            status={status}
                            seed={seed}
                            results={blankResults}
                          />
                        )}
                        {step.type === "order" && (
                          <OrderExercise step={step} value={order} onChange={setOrder} status={status} seed={seed} />
                        )}
                        {step.type === "match" && (
                          <MatchExercise step={step} value={match} onChange={setMatch} status={status} seed={seed} />
                        )}
                      </motion.div>
                    </StepCard>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <footer
            className={`shrink-0 border-t transition-colors duration-300 ${
              status === "correct"
                ? "border-teal-400/25 bg-teal-950/70"
                : status === "wrong"
                  ? "border-rose-400/25 bg-rose-950/60"
                  : "border-white/10 bg-black"
            }`}
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 md:min-h-28 md:flex-row md:items-center md:justify-between">
              <div aria-live="polite" className="min-w-0 flex-1">
                {status !== "idle" && step && step.type !== "teach" && (
                  <Feedback
                    step={step}
                    noteKey={`${lesson.id}.${idx}`}
                    correct={status === "correct"}
                    streak={streak}
                    picked={picked?.why ? { index: choice[0], why: picked.why } : null}
                    comesBack={status === "wrong" && queue.lastIndexOf(idx) > pos}
                    misses={step.type === "match" ? match.mistakes : 0}
                  />
                )}
                {status === "idle" && step && <KeyHint step={step} resumedHere={resumedAt.current === pos} />}
              </div>
              {step?.type === "teach" || status !== "idle" ? (
                <button
                  ref={continueRef}
                  type="button"
                  onClick={advance}
                  aria-keyshortcuts="Enter"
                  className={`min-h-12 shrink-0 rounded-xl px-8 text-[15px] font-semibold transition-[transform,background-color] active:translate-y-px md:min-w-40 ${
                    status === "wrong"
                      ? "bg-rose-300 text-rose-950 hover:bg-rose-200"
                      : "bg-teal-300 text-teal-950 hover:bg-teal-200"
                  }`}
                >
                  {pos + 1 >= queue.length ? "Finish" : "Continue"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={check}
                  aria-keyshortcuts="Enter"
                  disabled={!ready || step?.type === "match"}
                  className="min-h-12 shrink-0 rounded-xl bg-white px-8 text-[15px] font-semibold text-black transition-[transform,background-color,opacity] hover:bg-gray-200 active:translate-y-px disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-400 md:min-w-40"
                >
                  {step?.type === "match" ? "Match every pair" : "Check"}
                </button>
              )}
            </div>
          </footer>
        </>
      )}

      {sheet && <ShortcutSheet scope="lesson" onClose={() => setSheet(false)} />}
    </div>
  );
}

/** What the keys do on this card, for screens with a keyboard and pointer. */
function KeyHint({ step, resumedHere }: { step: CourseStep; resumedHere: boolean }) {
  let hint: React.ReactNode;
  switch (step.type) {
    case "teach":
      hint = (
        <>
          <Kbd>Enter</Kbd> to continue
        </>
      );
      break;
    case "choice":
      hint = (
        <>
          <Kbd>1</Kbd>-<Kbd>{String(Math.min(step.choices.length, 9))}</Kbd> to pick, <Kbd>Enter</Kbd> to check
        </>
      );
      break;
    case "blank":
      hint = step.bank ? (
        <>
          A tile&apos;s key places it, <Kbd>Backspace</Kbd> takes one back, <Kbd>Enter</Kbd> to check
        </>
      ) : (
        <>
          Type, <Kbd>Tab</Kbd> to the next blank, <Kbd>Enter</Kbd> to check
        </>
      );
      break;
    case "order":
      hint = (
        <>
          Press the keys in order, <Kbd>Backspace</Kbd> takes one back, <Kbd>Enter</Kbd> to check
        </>
      );
      break;
    case "match":
      hint = <>Press a key on each side to pair them</>;
      break;
  }
  return (
    <p className="hidden text-sm leading-7 text-gray-400 [@media(pointer:fine)]:block">
      {resumedHere ? <span className="text-gray-300">Picked up where you left off. </span> : null}
      {hint}. <Kbd>?</Kbd> for every key
    </p>
  );
}

/**
 * SHAN-653: the words a learner can select for Add note and Explain. Each
 * piece is named `<lesson id>.<step index>.<part>` (b body, h heading, x
 * explanation, y<n> the why of choice n), so a note finds its text again on
 * the next visit and on the second try of the same card. Answers and tiles are
 * buttons and are left out.
 */
function StepCard({
  step,
  noteKey,
  promptRef,
  isRetry,
  lessonTitle,
  children,
}: {
  step: CourseStep;
  noteKey: string;
  promptRef: React.RefObject<HTMLHeadingElement | null>;
  isRetry: boolean;
  lessonTitle: string;
  children: React.ReactNode;
}) {
  const h = heading(step);
  // A screen reader announces each card as it arrives. A typed blank keeps
  // focus in its first input instead, so the learner can just type.
  useEffect(() => {
    if (!(step.type === "blank" && !step.bank)) promptRef.current?.focus({ preventScroll: true });
    // Mount only: StepCard is keyed per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <article data-note-heading={h ?? undefined}>
      {/* The kicker says what to do; when there is no prompt it becomes the
          heading instead, so it is never printed twice. */}
      {(h || isRetry) && (
        <p className="text-sm text-gray-400">
          {isRetry ? <span className="text-amber-200/90">Second try. </span> : null}
          {h ? kicker(step) : null}
        </p>
      )}
      <h2
        ref={promptRef}
        tabIndex={-1}
        className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight text-white outline-none md:text-[28px]"
      >
        {h ? (
          <LessonText inline noteTarget={`${noteKey}.h`}>
            {h}
          </LessonText>
        ) : step.type === "teach" ? (
          lessonTitle
        ) : (
          kicker(step)
        )}
      </h2>
      {step.type === "teach" ? (
        <div className="mt-6 space-y-6">
          <LessonText noteTarget={`${noteKey}.b`} className="max-w-[62ch] text-[17px] leading-relaxed text-gray-300">
            {step.body}
          </LessonText>
          {step.code && <CodeBlock code={step.code} language={step.language} />}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {step.code && <CodeBlock code={step.code} language={step.language} />}
          {children}
        </div>
      )}
    </article>
  );
}

function Feedback({
  step,
  noteKey,
  correct,
  streak,
  picked,
  comesBack,
  misses,
}: {
  step: Exclude<CourseStep, { type: "teach" }>;
  noteKey: string;
  correct: boolean;
  streak: number;
  picked: { index: number; why: string } | null;
  comesBack: boolean;
  misses: number;
}) {
  let answer: React.ReactNode = null;
  if (!correct) {
    if (step.type === "choice") answer = step.choices.filter((c) => c.correct).map((c) => c.text).join(", ");
    else if (step.type === "blank") answer = filledSentence(step.text);
    else if (step.type === "order")
      answer = (
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          {step.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ol>
      );
    else if (step.type === "match") answer = `All pairs placed, with ${misses} miss${misses === 1 ? "" : "es"} on the way.`;
  }
  const why = [
    picked && { target: `${noteKey}.y${picked.index}`, text: picked.why },
    step.explanation && { target: `${noteKey}.x`, text: step.explanation },
  ].filter(Boolean) as { target: string; text: string }[];
  return (
    <div className={correct ? "text-teal-50" : "text-rose-50"} data-note-heading={heading(step) ?? undefined}>
      <p className={`text-lg font-semibold ${correct ? "text-teal-200" : "text-rose-200"}`}>
        {correct ? (streak >= 3 ? `Correct. ${streak} in a row.` : "Correct") : "Not quite"}
      </p>
      {answer && (
        <div className="mt-1 text-sm">
          <span className="text-rose-200/80">{step.type === "match" ? "" : "Answer: "}</span>
          {answer}
        </div>
      )}
      {why.length > 0 && (
        <div className="mt-1.5 max-w-[68ch] space-y-1 text-sm text-white/80">
          {why.map((w) => (
            <LessonText key={w.target} noteTarget={w.target}>
              {w.text}
            </LessonText>
          ))}
        </div>
      )}
      {comesBack && <p className="mt-1.5 text-xs text-rose-200/70">This one comes back at the end.</p>}
    </div>
  );
}

function FinishScreen({
  lesson,
  score,
  ms,
  graded,
  firstTry,
  save,
  position,
  next,
  onNext,
  onExit,
  onRetrySave,
}: {
  lesson: CourseLesson;
  score: number;
  ms: number;
  graded: number;
  firstTry: Record<number, boolean>;
  save: SaveState;
  position: { index: number; total: number };
  next: { title: string } | null;
  onNext: () => void;
  onExit: () => void;
  onRetrySave: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const numberRef = useRef<HTMLSpanElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // A short count-up is the one celebration here. It writes the DOM directly
  // so it never re-renders React, and reduced motion gets the number at once.
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
    if (reduce || !numberRef.current) return;
    const el = numberRef.current;
    const controls = animate(0, score, {
      duration: 0.9,
      ease,
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [score, reduce]);

  const right = Object.values(firstTry).filter(Boolean).length;
  const missed = lesson.steps
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => isGraded(s) && firstTry[i] === false)
    .slice(0, 5);

  const saveLine: Record<SaveState, string> = {
    saving: "Saving your progress...",
    saved: "Saved to your progress.",
    local: "Saved on this device. Sign in to keep progress everywhere.",
    preview: "Preview run. Nothing was saved.",
    failed: "Could not save your progress.",
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-10 md:pt-20">
        <p className="text-sm text-gray-400">
          Lesson {position.index + 1} of {position.total} complete
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{lesson.title}</h2>

        <p className="mt-10 flex items-baseline gap-3">
          <span className="text-7xl font-semibold tabular-nums tracking-tighter text-teal-300 md:text-8xl">
            <span ref={numberRef}>{reduce ? score : 0}</span>%
          </span>
          <span className="text-sm text-gray-400">right on the first try</span>
        </p>

        <dl className="mt-8 grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-4 text-center">
          <div>
            <dt className="text-xs text-gray-400">Exercises</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{graded}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">First try</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{right}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Time</dt>
            <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">{clock(ms)}</dd>
          </div>
        </dl>

        {missed.length > 0 && (
          <section className="mt-10">
            <h3 className="text-sm font-semibold text-white">Worth another look</h3>
            <ul className="mt-3 space-y-3">
              {missed.map(({ s, i }) => (
                <li key={i} className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm">
                  <p className="text-gray-200">{heading(s) ?? kicker(s)}</p>
                  <p className="mt-1 text-gray-400">
                    {s.type === "choice" && s.choices.filter((c) => c.correct).map((c) => c.text).join(", ")}
                    {s.type === "blank" && filledSentence(s.text)}
                    {s.type === "order" && s.items.join(", then ")}
                    {s.type === "match" && s.pairs.map((p) => `${p[0]}: ${p[1]}`).join("; ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className={`mt-8 text-sm ${save === "failed" ? "text-rose-300" : "text-gray-400"}`} aria-live="polite">
          {saveLine[save]}{" "}
          {save === "failed" && (
            <button type="button" onClick={onRetrySave} className="underline underline-offset-2 hover:text-rose-200">
              Try again
            </button>
          )}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {next ? (
            <button
              ref={primaryRef}
              type="button"
              onClick={onNext}
              className="min-h-12 rounded-xl bg-teal-300 px-6 text-[15px] font-semibold text-teal-950 transition-[transform,background-color] hover:bg-teal-200 active:translate-y-px"
            >
              Next lesson
            </button>
          ) : null}
          <button
            ref={next ? undefined : primaryRef}
            type="button"
            onClick={onExit}
            className={
              next
                ? "min-h-12 rounded-xl bg-white/[0.08] px-6 text-[15px] text-gray-200 transition-colors hover:bg-white/[0.14]"
                : "min-h-12 rounded-xl bg-teal-300 px-6 text-[15px] font-semibold text-teal-950 transition-[transform,background-color] hover:bg-teal-200 active:translate-y-px"
            }
          >
            Back to course
          </button>
        </div>
        {next && <p className="mt-3 text-sm text-gray-400">Up next: {next.title}</p>}
      </div>
    </div>
  );
}
