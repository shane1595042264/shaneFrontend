"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/transition-link";
import { humanizeActionError, humanizeError } from "@/lib/humanize-error";
import {
  certificatePath,
  claimCertificate,
  getMyCertificate,
  getRecallCheck,
  submitRecall,
  type Course,
  type CourseCertificate,
  type RecallCheck,
} from "@/lib/api/courses";
import type { CourseLesson } from "@/lib/course-lessons";
import { ExamPlayer, formatOpening } from "./exam-player";

/**
 * SHAN-720. On a certified course: what it takes to earn the certificate, the
 * claim once every lesson is done, and a link to it afterwards. The server
 * checks completion again on claim; this only decides what to offer.
 *
 * SHAN-721: a certificate course carries an exam, and `doneCount` counts it
 * only once passed.
 *
 * SHAN-722: then the recall check. It opens a day after the last lesson, is
 * drawn from the whole course and sat in the exam player, and the claim waits
 * for it. `lastActivity` changes whenever a lesson is finished again, which
 * moves the opening, so the check's state is reloaded on it.
 */
export function CertificatePanel({
  course,
  user,
  doneCount,
  total,
  progressKnown,
  hasExam,
  lastActivity,
}: {
  course: Course;
  /** Null while signed out or before hydration. */
  user: { name: string | null } | null;
  doneCount: number;
  total: number;
  /** False while progress is loading or failed to load. */
  progressKnown: boolean;
  hasExam: boolean;
  /** The latest updatedAt across the learner's lesson and exam rows. */
  lastActivity: string | null;
}) {
  const [cert, setCert] = useState<CourseCertificate | null>(null);
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recall, setRecall] = useState<RecallCheck | null>(null);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [recallAttempt, setRecallAttempt] = useState(0);
  const [sitting, setSitting] = useState(false);

  const signedIn = !!user;
  useEffect(() => {
    setCert(null);
    setChecked(false);
    if (!signedIn || !course.certified) return;
    let cancelled = false;
    getMyCertificate(course.id)
      .then((c) => {
        if (!cancelled) setCert(c);
      })
      .catch((e) => {
        if (!cancelled) setError(humanizeError(e, "Could not check for your certificate."));
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [course.id, course.certified, signedIn]);

  useEffect(() => {
    if (user?.name) setName((n) => n || (user.name ?? ""));
  }, [user?.name]);

  const allDone = progressKnown && total > 0 && doneCount === total;
  const wantRecall = signedIn && course.certified && allDone && checked && !cert;

  useEffect(() => {
    if (!wantRecall || sitting) return;
    let cancelled = false;
    setRecallError(null);
    getRecallCheck(course.id)
      .then((r) => {
        if (!cancelled) setRecall(r);
      })
      .catch((e) => {
        if (!cancelled) setRecallError(humanizeError(e, "Could not load the recall check."));
      });
    return () => {
      cancelled = true;
    };
  }, [wantRecall, sitting, course.id, lastActivity, recallAttempt]);

  // A waiting check opens by itself while the page is up. Keyed on the fetched
  // check, not the opening time (SHAN-725): a clock running ahead of the
  // server's gets "waiting" back with the same opening, and has to ask again.
  // A timer can also sleep through the opening with the laptop, so coming back
  // to the tab checks too.
  useEffect(() => {
    const opensAt = recall?.status === "waiting" && recall.unlocksAt ? Date.parse(recall.unlocksAt) : null;
    if (opensAt === null || Number.isNaN(opensAt)) return;
    const recheck = () => setRecallAttempt((n) => n + 1);
    const due = opensAt - Date.now();
    // setTimeout overflows past ~24.8 days; nothing waits that long.
    const t = window.setTimeout(recheck, due > 0 ? due + 1000 : 15_000);
    const onWake = () => {
      if (document.visibilityState === "visible" && Date.now() >= opensAt) recheck();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [recall]);

  const recallLesson = useMemo<CourseLesson | null>(
    () =>
      recall?.draw
        ? {
            id: "recall",
            title: "Recall check",
            summary: `${recall.questions} questions from across ${course.title}, answered from memory.`,
            exam: { passMark: recall.passMark },
            steps: recall.draw.steps,
          }
        : null,
    [recall, course.title],
  );

  const draw = recall?.draw?.id;
  const sit = useCallback(
    (answers: unknown[]) => {
      if (!draw) return Promise.reject(new Error("The recall check is not open"));
      return submitRecall(course.id, draw, answers);
    },
    [course.id, draw],
  );

  if (!course.certified) return null;

  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCert(await claimCertificate(course.id, name.trim() || undefined));
    } catch (err) {
      setError(humanizeActionError(err, "Could not issue your certificate."));
    } finally {
      setBusy(false);
    }
  };

  const left = total - doneCount;
  const andExam = hasExam ? " and pass the exam" : "";
  const steps = `Finish every lesson${andExam}, then pass a recall check a day later,`;
  const lastSitting = recall?.result && !recall.result.passedAt ? recall.result : null;

  return (
    <section
      aria-labelledby="course-certificate-heading"
      className="mt-8 rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-5"
    >
      <h2 id="course-certificate-heading" className="text-sm font-semibold text-amber-100">
        {cert ? "Your certificate" : "Certificate course"}
      </h2>
      {cert ? (
        <p className="mt-1 text-sm text-gray-300">
          Issued to {cert.recipientName}.{" "}
          <Link href={certificatePath(cert.code)} className="font-medium text-amber-200 underline-offset-4 hover:underline">
            View your certificate &rarr;
          </Link>
        </p>
      ) : !signedIn ? (
        <p className="mt-1 text-sm text-gray-300">
          {steps} to earn a certificate signed by Shane. Sign in to claim it.
        </p>
      ) : !allDone || recall?.status === "lessons" ? (
        <p className="mt-1 text-sm text-gray-300">
          Finish all {total} lessons{andExam}, then pass a recall check a day later, to earn a certificate signed by
          Shane
          {progressKnown && doneCount > 0 && left > 0 ? (
            <span className="tabular-nums">
              {" "}
              ({left} to go)
            </span>
          ) : null}
          .
        </p>
      ) : !checked || (!recall && !recallError) ? null : recallError ? (
        <p role="alert" className="mt-1 text-sm text-red-400">
          {recallError}{" "}
          <button
            type="button"
            onClick={() => setRecallAttempt((n) => n + 1)}
            className="font-medium text-amber-200 underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </p>
      ) : recall?.status === "waiting" && recall.unlocksAt ? (
        <div className="mt-1 space-y-1 text-sm text-gray-300">
          <p>
            Every lesson is done{hasExam ? " and the exam is passed" : ""}. Last step: the recall check,{" "}
            {recall.questions} questions drawn from the whole course and answered from memory, pass mark{" "}
            {recall.passMark}%. It opens <strong className="font-semibold text-white">{formatOpening(recall.unlocksAt)}</strong>.
          </p>
          <p className="text-gray-400">
            {lastSitting ? `Your last sitting scored ${lastSitting.lastScore}%. ` : ""}
            The wait is the point: it checks what you still know a day later. Practising a lesson before then moves
            the opening to a day after that practice.
          </p>
        </div>
      ) : recall?.status === "open" ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="w-full text-sm text-gray-300">
            The recall check is open: {recall.questions} questions drawn from every lesson, answered from memory with
            no feedback until the end. Pass mark {recall.passMark}%; a miss opens again a day later, with new
            questions.
            {lastSitting ? ` Your last sitting scored ${lastSitting.lastScore}%.` : ""}
          </p>
          <button
            type="button"
            onClick={() => setSitting(true)}
            className="inline-flex min-h-10 items-center rounded-lg bg-amber-200 px-4 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100"
          >
            Take the recall check
          </button>
        </div>
      ) : recall?.status === "passed" ? (
        <form onSubmit={claim} className="mt-2 flex flex-wrap items-end gap-3">
          <p className="w-full text-sm text-gray-300">
            Every lesson is done{hasExam ? ", the exam is passed" : ""} and the recall check is passed. Choose the
            name to print on your certificate; it cannot be changed later.
          </p>
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm text-gray-400">
            Name on the certificate
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              className="min-h-10 rounded-lg border border-white/15 bg-black/40 px-3 text-white focus:border-amber-300/60 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex min-h-10 items-center rounded-lg bg-amber-200 px-4 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100 disabled:opacity-60"
          >
            {busy ? "Issuing…" : "Claim your certificate"}
          </button>
        </form>
      ) : null}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {sitting && recallLesson && (
        <ExamPlayer
          kind="recall"
          lesson={recallLesson}
          unitTitle={course.title}
          signedIn={signedIn}
          best={recall?.result ?? undefined}
          onSubmit={sit}
          onExit={() => setSitting(false)}
        />
      )}
    </section>
  );
}
