"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useHydrated } from "@/lib/use-hydrated";
import { humanizeError } from "@/lib/humanize-error";
import { LoadError } from "@/components/load-error";
import { listCourseProgress, recordLessonProgress, type Course } from "@/lib/api/courses";
import {
  clearLessonRun,
  clearLocalProgress,
  exerciseCount,
  flatLessons,
  lessonMinutes,
  readLessonRun,
  readLocalProgress,
  writeLessonRun,
  writeLocalProgress,
  type CourseContent,
  type CourseProgress,
  type LessonRun,
  type SavedLessonRun,
} from "@/lib/course-lessons";
import { isTyping, keysBlocked, pressedKey } from "./exercises";
import { LessonPlayer, type SaveState } from "./lesson-player";
import { Kbd, ShortcutSheet } from "./shortcut-sheet";

// One load per course at a time, so an effect that re-runs while uploads are
// in flight (auth settling, Strict Mode) waits for them instead of recording
// the same lesson a second time.
const loading = new Map<string, Promise<CourseProgress[]>>();

/**
 * SHAN-656. The signed-in progress list, with anything this browser finished
 * signed out added to the account first. A local lesson is uploaded only when
 * the server has no row for it (the server's row wins) and the course still
 * has it (the server would 404). It goes up as one run at its best score; the
 * local attempt count is not carried over. The local copy is cleared once
 * every upload has landed. A failed one stays local and stays shown as done,
 * and the next load retries it; lessons that did land are skipped then.
 */
function loadProgress(courseId: string, lessonIds: Set<string>): Promise<CourseProgress[]> {
  const inFlight = loading.get(courseId);
  if (inFlight) return inFlight;
  const run = (async () => {
    const server = await listCourseProgress(courseId);
    const have = new Set(server.map((p) => p.lessonId));
    const pending = readLocalProgress(courseId).filter(
      (p) => lessonIds.has(p.lessonId) && !have.has(p.lessonId),
    );
    const kept: CourseProgress[] = [];
    for (const p of pending) {
      try {
        server.push(await recordLessonProgress(courseId, p.lessonId, p.bestScore));
      } catch {
        kept.push(p);
      }
    }
    if (kept.length === 0) clearLocalProgress(courseId);
    return [...server, ...kept];
  })().finally(() => loading.delete(courseId));
  loading.set(courseId, run);
  return run;
}

/**
 * SHAN-652. The lesson path on a course page and the player it opens.
 *
 * The open lesson lives in `?lesson=<id>` so a lesson can be linked and Back
 * closes it. It is read from `location` in an effect rather than through
 * useSearchParams, which would force a Suspense boundary onto this ISR page
 * (and the hydration render must match the server, which has no lesson open).
 *
 * Signed-in progress is stored on the server; signed out, it is kept in
 * localStorage so a visitor still sees their path fill in.
 *
 * SHAN-659: a lesson left halfway is kept on this device (readLessonRun) and
 * the primary button becomes Resume. The page also takes keys, vim-style:
 * j/k walk the lesson rows, g/G jump to the ends, Enter opens the row, r
 * resumes, ? shows the sheet. Rows are real buttons, so the keys only move
 * focus and the browser does the rest.
 */

function lessonParam(): string | null {
  return new URLSearchParams(window.location.search).get("lesson");
}

function urlWithLesson(id: string | null): string {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("lesson", id);
  else url.searchParams.delete("lesson");
  return url.pathname + url.search + url.hash;
}

export function CourseLessons({
  course,
  content,
  deckHref,
  aside,
}: {
  course: Course;
  content: CourseContent;
  deckHref: string | null;
  aside?: ReactNode;
}) {
  const { user: authUser, loading: authLoading } = useAuth();
  const hydrated = useHydrated();
  const user = hydrated ? authUser : null;
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  // SHAN-654: a failed load is not "nothing done yet". Retry bumps the attempt.
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressAttempt, setProgressAttempt] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  // True while the open lesson is a history entry we pushed, so closing it
  // pops that entry instead of leaving a dead one behind for Back.
  const pushed = useRef(false);
  const [saved, setSaved] = useState<SavedLessonRun | null>(null);
  const [sheet, setSheet] = useState(false);
  const pathRef = useRef<HTMLElement>(null);

  const lessons = useMemo(() => flatLessons(content), [content]);
  const byId = useMemo(() => new Map(lessons.map((l) => [l.lesson.id, l])), [lessons]);
  const lessonIds = useMemo(() => new Set(byId.keys()), [byId]);
  const done = useMemo(() => new Map(progress.map((p) => [p.lessonId, p])), [progress]);
  const doneCount = lessons.filter((l) => done.has(l.lesson.id)).length;
  // With the load failed we do not know where the learner is, so nothing is
  // marked as next.
  const nextUp = progressError ? null : (lessons.find((l) => !done.has(l.lesson.id)) ?? null);
  const lessonMap = useMemo(() => new Map(lessons.map((l) => [l.lesson.id, l.lesson])), [lessons]);



  useEffect(() => {
    if (!hydrated || authLoading) return;
    let cancelled = false;
    setProgressError(null);
    if (!authUser) {
      setProgress(readLocalProgress(course.id));
      return;
    }
    loadProgress(course.id, lessonIds)
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch((e) => {
        if (!cancelled) setProgressError(humanizeError(e, "Could not load your progress."));
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, authLoading, authUser, course.id, lessonIds, progressAttempt]);

  // Deep link on arrival, and Back/Forward while here.
  useEffect(() => {
    const sync = () => {
      // Read in the same pass that opens a deep-linked lesson, so the player
      // mounts with the saved place already in hand.
      setSaved(readLessonRun(course.id, lessonMap));
      const id = lessonParam();
      if (!id) pushed.current = false;
      setActive(id && byId.has(id) ? id : null);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [byId, course.id, lessonMap]);

  const open = (id: string) => {
    setRun((r) => r + 1);
    setActive(id);
    pushed.current = true;
    window.history.pushState({ ...window.history.state, lesson: id }, "", urlWithLesson(id));
  };

  const close = useCallback(() => {
    setActive(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    window.history.replaceState({ ...window.history.state, lesson: undefined }, "", urlWithLesson(null));
  }, []);

  const current = active ? byId.get(active) : undefined;
  const after = current ? lessons[current.index + 1] : undefined;

  const goNext = () => {
    if (!after) return;
    setRun((r) => r + 1);
    setActive(after.lesson.id);
    window.history.replaceState({ ...window.history.state, lesson: after.lesson.id }, "", urlWithLesson(after.lesson.id));
  };

  const keepPlace = useCallback(
    (r: LessonRun) => {
      if (current) setSaved(writeLessonRun(course.id, current.lesson, r));
    },
    [current, course.id],
  );

  const restart = useCallback(() => {
    clearLessonRun(course.id);
    setSaved(null);
    setRun((r) => r + 1);
  }, [course.id]);

  const finish = useCallback(
    async (score: number): Promise<SaveState> => {
      if (!current) return "failed";
      const lessonId = current.lesson.id;
      clearLessonRun(course.id);
      setSaved(null);
      if (!authUser) {
        const p = writeLocalProgress(course.id, lessonId, score);
        setProgress((all) => [...all.filter((x) => x.lessonId !== lessonId), p]);
        return "local";
      }
      const p = await recordLessonProgress(course.id, lessonId, score);
      setProgress((all) => [...all.filter((x) => x.lessonId !== lessonId), p]);
      // The list we hold is only this lesson; load the real one now that the
      // server is answering again.
      if (progressError) setProgressAttempt((n) => n + 1);
      return "saved";
    },
    [current, authUser, course.id, progressError],
  );

  const allDone = doneCount === lessons.length && lessons.length > 0;
  const savedEntry = saved ? byId.get(saved.lessonId) : undefined;
  const primaryLabel = savedEntry
    ? "Resume"
    : progressError
      ? "Open the first lesson"
      : allDone
        ? "Practice again"
        : doneCount > 0
          ? "Continue"
          : "Start course";
  const primaryTarget = savedEntry ? savedEntry.lesson.id : (nextUp ?? lessons[0])?.lesson.id;
  const savedCard = saved ? `card ${saved.run.pos + 1} of ${saved.run.queue.length}` : "";

  // Page keys. Off while a lesson is open (the player has its own), while
  // typing (comments, notes) and while any dialog or notes card is up.
  const keys = useRef({ primaryTarget, open, sheet });
  keys.current = { primaryTarget, open, sheet };
  useEffect(() => {
    if (active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (keys.current.sheet) return; // the sheet closes itself
      if (keysBlocked() || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const rows = Array.from(pathRef.current?.querySelectorAll<HTMLElement>("[data-lesson-row]") ?? []);
      const at = rows.indexOf(document.activeElement as HTMLElement);
      const go = (i: number) => {
        e.preventDefault();
        rows[Math.max(0, Math.min(rows.length - 1, i))]?.focus();
      };
      switch (pressedKey(e)) {
        case "j":
          // From nowhere, j lands on the lesson that is next, not the top.
          return go(at >= 0 ? at + 1 : Math.max(0, rows.findIndex((r) => r.dataset.lessonRow === keys.current.primaryTarget)));
        case "k":
          return go(at >= 0 ? at - 1 : Math.max(0, rows.findIndex((r) => r.dataset.lessonRow === keys.current.primaryTarget)));
        case "g":
          return go(0);
        case "G":
          return go(rows.length - 1);
        case "r":
          if (!keys.current.primaryTarget) return;
          e.preventDefault();
          keys.current.open(keys.current.primaryTarget);
          return;
        case "?":
          e.preventDefault();
          setSheet(true);
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      const key = pressedKey(e);
      if (key === "Escape" || (key === "?" && !e.repeat)) {
        e.preventDefault();
        setSheet(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {primaryTarget && (
            <button
              type="button"
              onClick={() => open(primaryTarget)}
              aria-keyshortcuts="r"
              className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-white px-6 text-[15px] font-semibold text-black transition-[transform,background-color] hover:bg-gray-200 active:translate-y-px"
            >
              {primaryLabel}
              <kbd
                aria-hidden="true"
                className="hidden h-6 min-w-6 place-items-center rounded-md border border-black/15 px-1 font-mono text-[11px] font-normal leading-none text-black/60 [@media(pointer:fine)]:grid"
              >
                r
              </kbd>
            </button>
          )}
          {deckHref && (
            <a
              href={deckHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center rounded-xl px-4 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Open the slide deck
            </a>
          )}
        </div>
        {aside}
      </div>

      <div className="mt-5">
        <div className="flex gap-1" aria-hidden="true">
          {lessons.map((l) => (
            <span
              key={l.lesson.id}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                done.has(l.lesson.id) ? "bg-teal-400" : "bg-white/[0.08]"
              }`}
            />
          ))}
        </div>
        {progressError ? (
          <div className="mt-2">
            <LoadError message={progressError} onRetry={() => setProgressAttempt((n) => n + 1)} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">
            <span className="tabular-nums">
              {doneCount} of {lessons.length}
            </span>{" "}
            lessons done
            {savedEntry ? (
              <span className="text-gray-300">
                . In progress: {savedEntry.lesson.title}, {savedCard}
              </span>
            ) : nextUp && doneCount > 0 ? (
              <span className="text-gray-300">. Next: {nextUp.lesson.title}</span>
            ) : null}
            {!user && hydrated && !authLoading && doneCount > 0 ? <span>. Saved on this device.</span> : null}
          </p>
        )}
      </div>

      <section ref={pathRef} aria-labelledby="course-lessons-heading" className="mt-12">
        <h2 id="course-lessons-heading" className="sr-only">
          Lessons
        </h2>
        {content.units.map((unit) => {
          const unitDone = unit.lessons.filter((l) => done.has(l.id)).length;
          return (
            <div key={unit.id} className="mt-12 first:mt-0">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold tracking-tight text-white">{unit.title}</h3>
                <span className="shrink-0 text-sm tabular-nums text-gray-400">
                  {unitDone} of {unit.lessons.length}
                </span>
              </div>
              {unit.summary && <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-gray-400">{unit.summary}</p>}
              <ol className="relative mt-4">
                {unit.lessons.length > 1 && (
                  <span aria-hidden="true" className="absolute bottom-7 left-[1.4rem] top-7 w-px bg-white/10" />
                )}
                {unit.lessons.map((lesson) => {
                  const entry = byId.get(lesson.id);
                  const p = done.get(lesson.id);
                  const isNext = nextUp?.lesson.id === lesson.id;
                  const inProgress = saved?.lessonId === lesson.id;
                  const n = (entry?.index ?? 0) + 1;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        data-lesson-row={lesson.id}
                        onClick={() => open(lesson.id)}
                        className="group flex w-full scroll-mt-under-header scroll-mb-24 items-center gap-4 rounded-xl py-2.5 pl-1 pr-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <span
                          aria-hidden="true"
                          className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums transition-[transform,background-color] group-hover:scale-105 ${
                            p
                              ? "bg-teal-400 text-teal-950"
                              : isNext || inProgress
                                ? "bg-black text-teal-200 ring-2 ring-teal-300"
                                : "border border-white/15 bg-black text-gray-400"
                          }`}
                        >
                          {p ? "✓" : n}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-gray-100 group-hover:text-white">
                            {lesson.title}
                          </span>
                          <span className="mt-0.5 block text-sm text-gray-400">
                            {exerciseCount(lesson)} exercises, about {lessonMinutes(lesson)} min
                          </span>
                        </span>
                        {inProgress && saved ? (
                          <span className="shrink-0 rounded-lg bg-white/[0.08] px-3 py-1.5 text-sm text-white">
                            Resume at card {saved.run.pos + 1}
                          </span>
                        ) : p ? (
                          <span className="shrink-0 text-sm tabular-nums text-teal-300">
                            <span className="sr-only">Done, best score </span>
                            {p.bestScore}%
                          </span>
                        ) : isNext ? (
                          <span className="shrink-0 rounded-lg bg-white/[0.08] px-3 py-1.5 text-sm text-white">
                            {doneCount > 0 ? "Up next" : "Start here"}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </section>

      <p className="mt-10 hidden text-sm leading-7 text-gray-400 [@media(pointer:fine)]:block">
        <Kbd>j</Kbd> <Kbd>k</Kbd> to move, <Kbd>Enter</Kbd> to open, <Kbd>r</Kbd> to {savedEntry ? "resume" : "go"},{" "}
        <Kbd>?</Kbd> for every key.
      </p>

      {sheet && <ShortcutSheet scope="course" onClose={() => setSheet(false)} />}

      {current && (
        <LessonPlayer
          key={`${current.lesson.id}-${run}`}
          lesson={current.lesson}
          unitTitle={current.unit.title}
          position={{ index: current.index, total: lessons.length }}
          next={after ? { title: after.lesson.title } : null}
          onExit={close}
          onNext={goNext}
          onFinish={finish}
          resume={saved?.lessonId === current.lesson.id ? saved.run : null}
          onProgress={keepPlace}
          onRestart={restart}
        />
      )}
    </>
  );
}
