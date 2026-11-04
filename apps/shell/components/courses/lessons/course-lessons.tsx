"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useHydrated } from "@/lib/use-hydrated";
import { humanizeError } from "@/lib/humanize-error";
import { LoadError } from "@/components/load-error";
import { listCourseProgress, recordLessonProgress, type Course } from "@/lib/api/courses";
import {
  exerciseCount,
  flatLessons,
  lessonMinutes,
  readLocalProgress,
  writeLocalProgress,
  type CourseContent,
  type CourseProgress,
} from "@/lib/course-lessons";
import { LessonPlayer, type SaveState } from "./lesson-player";

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

  const lessons = useMemo(() => flatLessons(content), [content]);
  const byId = useMemo(() => new Map(lessons.map((l) => [l.lesson.id, l])), [lessons]);
  const done = useMemo(() => new Map(progress.map((p) => [p.lessonId, p])), [progress]);
  const doneCount = lessons.filter((l) => done.has(l.lesson.id)).length;
  // With the load failed we do not know where the learner is, so nothing is
  // marked as next.
  const nextUp = progressError ? null : (lessons.find((l) => !done.has(l.lesson.id)) ?? null);

  useEffect(() => {
    if (!hydrated || authLoading) return;
    let cancelled = false;
    setProgressError(null);
    if (!authUser) {
      setProgress(readLocalProgress(course.id));
      return;
    }
    listCourseProgress(course.id)
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch((e) => {
        if (!cancelled) setProgressError(humanizeError(e, "Could not load your progress."));
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, authLoading, authUser, course.id, progressAttempt]);

  // Deep link on arrival, and Back/Forward while here.
  useEffect(() => {
    const sync = () => {
      const id = lessonParam();
      if (!id) pushed.current = false;
      setActive(id && byId.has(id) ? id : null);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [byId]);

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

  const finish = useCallback(
    async (score: number): Promise<SaveState> => {
      if (!current) return "failed";
      const lessonId = current.lesson.id;
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
  const primaryLabel = progressError
    ? "Open the first lesson"
    : allDone
      ? "Practice again"
      : doneCount > 0
        ? "Continue"
        : "Start course";
  const primaryTarget = (nextUp ?? lessons[0])?.lesson.id;

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {primaryTarget && (
            <button
              type="button"
              onClick={() => open(primaryTarget)}
              className="min-h-12 rounded-xl bg-white px-6 text-[15px] font-semibold text-black transition-[transform,background-color] hover:bg-gray-200 active:translate-y-px"
            >
              {primaryLabel}
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
            {nextUp && doneCount > 0 ? <span className="text-gray-300">. Next: {nextUp.lesson.title}</span> : null}
            {!user && hydrated && !authLoading && doneCount > 0 ? <span>. Saved on this device.</span> : null}
          </p>
        )}
      </div>

      <section aria-labelledby="course-lessons-heading" className="mt-12">
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
                  const n = (entry?.index ?? 0) + 1;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => open(lesson.id)}
                        className="group flex w-full items-center gap-4 rounded-xl py-2.5 pl-1 pr-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <span
                          aria-hidden="true"
                          className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums transition-[transform,background-color] group-hover:scale-105 ${
                            p
                              ? "bg-teal-400 text-teal-950"
                              : isNext
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
                        {p ? (
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
        />
      )}
    </>
  );
}
