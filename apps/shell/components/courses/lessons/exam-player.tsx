"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { humanizeActionError } from "@/lib/humanize-error";
import { isGraded, type CourseLesson, type CourseStep, type ExamResult } from "@/lib/course-lessons";
import type { ExamSubmission } from "@/lib/api/courses";
import { BlankExercise, ChoiceExercise, OrderExercise, ReciteExercise, isTyping, pressedKey } from "./exercises";
import { CodeBlock, LessonText } from "./lesson-text";
import { TeachVisualView } from "./teach-visual";
import { heading, kicker } from "./lesson-player";

/**
 * SHAN-721. An exam lesson, the part of a certificate course that cannot be
 * clicked through. The steps arrive without their answers, every question is
 * answered once with no feedback in between, and the server grades the whole
 * sheet on Submit. Back and Next move freely until then, so an answer can be
 * changed before it counts. The result says which questions were wrong but
 * never what was right, so a resit is still a test.
 *
 * No notes, Explain or knowledge terms in here: each is a way to look the
 * answer up. Escape leaves at once, as in a lesson; answers not submitted are
 * not kept.
 */

type Answer = number[] | string[] | string;
type Phase = "intro" | "taking" | "submitting" | "result";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function answered(step: CourseStep, a: Answer | undefined): boolean {
  switch (step.type) {
    case "teach":
      return true;
    case "choice":
      return Array.isArray(a) && a.length > 0;
    case "blank":
      return (
        Array.isArray(a) &&
        a.length === (step.text.match(/\[\[[^\[\]]+\]\]/g)?.length ?? 0) &&
        (a as string[]).every((s) => s.trim().length > 0)
      );
    case "order":
      return Array.isArray(a) && a.length === step.items.length;
    case "recite":
      return typeof a === "string" && a.trim().length > 0;
    case "match":
      return false;
  }
}

export function ExamPlayer({
  lesson,
  unitTitle,
  signedIn,
  best,
  onSubmit,
  onExit,
}: {
  lesson: CourseLesson;
  unitTitle: string;
  signedIn: boolean;
  /** The best sitting so far, if any. */
  best: ExamResult | undefined;
  onSubmit: (answers: unknown[]) => Promise<ExamSubmission>;
  onExit: () => void;
}) {
  useScrollLock(true);
  const steps = lesson.steps;
  const passMark = lesson.exam?.passMark ?? 80;
  const questions = useMemo(() => steps.filter(isGraded).length, [steps]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [result, setResult] = useState<ExamSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const [returnTo] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => () => returnTo?.focus?.({ preventScroll: true }), [returnTo]);

  const step = steps[pos];
  const done = steps.filter((s, i) => isGraded(s) && answered(s, answers[i])).length;
  const last = pos === steps.length - 1;

  const set = (v: Answer) => setAnswers((a) => ({ ...a, [pos]: v }));

  const start = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    setPos(0);
    setPhase("taking");
  };

  const submit = useCallback(async () => {
    setPhase("submitting");
    setError(null);
    try {
      setResult(await onSubmit(steps.map((_, i) => answers[i] ?? null)));
      setPhase("result");
    } catch (e) {
      setError(humanizeActionError(e, "Could not submit the exam. Your answers are still here; try again."));
      setPhase("taking");
    }
  }, [onSubmit, steps, answers]);

  const next = useCallback(() => {
    if (phase !== "taking") return;
    if (last) void submit();
    else setPos((p) => p + 1);
  }, [phase, last, submit]);
  const back = useCallback(() => {
    if (phase === "taking") setPos((p) => Math.max(0, p - 1));
  }, [phase]);

  // Each card, and each new screen, starts with its heading focused, unless
  // the card types first (a recital or a typed blank focuses its own field).
  useEffect(() => {
    const typesFirst = step && (step.type === "recite" || (step.type === "blank" && !step.tiles && !step.bank));
    if (phase !== "taking" || !typesFirst) headRef.current?.focus({ preventScroll: true });
  }, [phase, pos, step]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const root = rootRef.current;
      const key = pressedKey(e);
      if (key === "Tab" && root) {
        const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const lastItem = items[items.length - 1];
        const active = document.activeElement;
        if (!root.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && active === lastItem) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }
      if (phase !== "taking") return;
      if ((key === "ArrowLeft" || key === "ArrowRight") && !isTyping(e.target) && !(e.altKey || e.metaKey || e.ctrlKey || e.shiftKey)) {
        e.preventDefault();
        if (key === "ArrowLeft") back();
        else if (!last) next();
        return;
      }
      // Enter moves on; a focused button handles Enter itself, and Submit
      // takes a click or Enter on the button, never a stray Enter in a field.
      if (key === "Enter" && !(e.target instanceof HTMLButtonElement) && !e.shiftKey) {
        e.preventDefault();
        if (!last) next();
      }
    },
    [phase, onExit, back, next, last],
  );
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const seed = `${lesson.id}:${pos}:exam`;

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
          aria-label="Close exam"
          aria-keyshortcuts="Escape"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-2xl leading-none text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <span aria-hidden="true">&times;</span>
        </button>
        <span className="rounded-md border border-amber-300/40 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-200">
          Exam
        </span>
        {phase === "taking" || phase === "submitting" ? (
          <span className="ml-auto text-sm tabular-nums text-gray-400">
            Question {pos + 1} of {steps.length}, {done} of {questions} answered
          </span>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6 md:pt-12">
          {phase === "intro" && (
            <section>
              <p className="text-sm text-gray-400">{unitTitle}</p>
              <h2 ref={headRef} tabIndex={-1} className="mt-2 text-3xl font-semibold tracking-tight text-white outline-none">
                {lesson.title}
              </h2>
              {lesson.summary && <p className="mt-3 max-w-[62ch] text-gray-300">{lesson.summary}</p>}
              <ul className="mt-8 space-y-2 text-[15px] text-gray-300">
                <li>
                  {questions} question{questions === 1 ? "" : "s"}. Pass mark {passMark}%.
                </li>
                <li>No feedback until you submit, and no second try at a question inside a sitting.</li>
                <li>Back and Next move freely, so you can change an answer before you submit.</li>
                <li>Recitals are graded for meaning, so your own words are fine.</li>
              </ul>
              {best && (
                <p className="mt-6 text-sm text-gray-400">
                  Your best so far: <span className="tabular-nums text-white">{best.bestScore}%</span>
                  {best.bestScore >= passMark ? ", passed." : ", not passed yet."}
                </p>
              )}
              {signedIn ? (
                <button
                  type="button"
                  onClick={start}
                  className="mt-8 min-h-12 rounded-xl bg-white px-8 text-[15px] font-semibold text-black transition-[transform,background-color] hover:bg-gray-200 active:translate-y-px"
                >
                  {best ? "Take it again" : "Start the exam"}
                </button>
              ) : (
                <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
                  Sign in to take this exam. It is graded on the server, and passing it is what a certificate asks for.
                </p>
              )}
            </section>
          )}

          {(phase === "taking" || phase === "submitting") && step && (
            <article key={pos}>
              {heading(step) && <p className="text-sm text-gray-400">{kicker(step)}</p>}
              <h2
                ref={headRef}
                tabIndex={-1}
                className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight text-white outline-none md:text-[28px]"
              >
                <LessonText inline>{heading(step) ?? (step.type === "teach" ? lesson.title : kicker(step))}</LessonText>
              </h2>
              <div className="mt-6 space-y-6">
                {step.type === "teach" ? (
                  <>
                    {step.visual?.kind === "emoji" && <TeachVisualView visual={step.visual} />}
                    <LessonText className="max-w-[62ch] text-[17px] leading-relaxed text-gray-300">{step.body}</LessonText>
                    {step.visual && step.visual.kind !== "emoji" && <TeachVisualView visual={step.visual} />}
                    {step.code && <CodeBlock code={step.code} language={step.language} />}
                  </>
                ) : (
                  <>
                    {step.code && <CodeBlock code={step.code} language={step.language} />}
                    {step.type === "choice" && (
                      <ChoiceExercise step={step} value={(answers[pos] as number[]) ?? []} onChange={set} status="idle" />
                    )}
                    {step.type === "blank" && (
                      <BlankExercise
                        step={step}
                        value={(answers[pos] as string[]) ?? []}
                        onChange={set}
                        status="idle"
                        seed={seed}
                        results={null}
                      />
                    )}
                    {step.type === "order" && (
                      <OrderExercise step={step} value={(answers[pos] as string[]) ?? []} onChange={set} status="idle" seed={seed} />
                    )}
                    {step.type === "recite" && (
                      <ReciteExercise
                        step={step}
                        value={(answers[pos] as string) ?? ""}
                        onChange={set}
                        locked={phase === "submitting"}
                      />
                    )}
                  </>
                )}
              </div>
            </article>
          )}

          {phase === "result" && result && (
            <ExamResultView lesson={lesson} result={result} headRef={headRef} />
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-black">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 md:min-h-28 md:flex-row md:items-center md:justify-between">
          <div aria-live="polite" className="min-w-0 flex-1 text-sm">
            {error ? (
              <p role="alert" className="text-rose-300">
                {error}
              </p>
            ) : phase === "submitting" ? (
              <p className="text-gray-300">Grading your answers. Recitals can take a few seconds.</p>
            ) : phase === "taking" && last && done < questions ? (
              <p className="text-amber-200/90">
                {questions - done} question{questions - done === 1 ? "" : "s"} unanswered. Unanswered questions count as wrong.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-3">
            {(phase === "taking" || phase === "submitting") && pos > 0 && (
              <button
                type="button"
                onClick={back}
                disabled={phase === "submitting"}
                aria-keyshortcuts="ArrowLeft"
                className="min-h-12 rounded-xl bg-white/[0.07] px-5 text-[15px] text-gray-200 transition-[transform,background-color] hover:bg-white/[0.13] active:translate-y-px disabled:opacity-50"
              >
                <span aria-hidden="true">&larr; </span>Back
              </button>
            )}
            {(phase === "taking" || phase === "submitting") && (
              <button
                type="button"
                onClick={next}
                disabled={phase === "submitting"}
                aria-keyshortcuts={last ? undefined : "ArrowRight Enter"}
                className={`min-h-12 flex-1 rounded-xl px-8 text-[15px] font-semibold transition-[transform,background-color] active:translate-y-px disabled:opacity-60 md:min-w-40 md:flex-none ${
                  last ? "bg-amber-200 text-amber-950 hover:bg-amber-100" : "bg-white text-black hover:bg-gray-200"
                }`}
              >
                {phase === "submitting" ? "Grading..." : last ? "Submit exam" : "Next"}
              </button>
            )}
            {phase === "result" && (
              <>
                <button
                  type="button"
                  onClick={start}
                  className="min-h-12 rounded-xl bg-white/[0.08] px-6 text-[15px] text-gray-200 transition-colors hover:bg-white/[0.14]"
                >
                  Take it again
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="min-h-12 rounded-xl bg-white px-6 text-[15px] font-semibold text-black transition-[transform,background-color] hover:bg-gray-200 active:translate-y-px"
                >
                  Back to course
                </button>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function ExamResultView({
  lesson,
  result,
  headRef,
}: {
  lesson: CourseLesson;
  result: ExamSubmission;
  headRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const wrong = result.steps.filter((s) => !s.correct);
  return (
    <section>
      <p className="text-sm text-gray-400">{lesson.title}</p>
      <h2 ref={headRef} tabIndex={-1} className="mt-2 text-2xl font-semibold tracking-tight text-white outline-none">
        {result.passed ? "Passed" : "Not passed yet"}
      </h2>
      <p className="mt-8 flex items-baseline gap-3">
        <span
          className={`text-7xl font-semibold tabular-nums tracking-tighter md:text-8xl ${
            result.passed ? "text-teal-300" : "text-rose-300"
          }`}
        >
          {result.score}%
        </span>
        <span className="text-sm text-gray-400">
          {result.right} of {result.graded} right. Pass mark {result.passMark}%.
        </span>
      </p>
      {result.result.bestScore > result.score && (
        <p className="mt-3 text-sm text-gray-400">Your best sitting is still {result.result.bestScore}%.</p>
      )}
      {wrong.length > 0 && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold text-white">Missed</h3>
          <p className="mt-1 text-sm text-gray-400">The answers stay hidden, so the next sitting is still a test.</p>
          <ul className="mt-3 space-y-3">
            {wrong.map((s) => {
              const step = lesson.steps[s.index];
              return (
                <li key={s.index} className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm">
                  <p className="text-gray-200">
                    <span className="tabular-nums text-gray-400">Question {s.index + 1}. </span>
                    {step ? (heading(step) ?? kicker(step)) : null}
                  </p>
                  {s.feedback && <p className="mt-1 text-gray-400">{s.feedback}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}
