"use client";

import { useEffect, useState } from "react";
import Link from "@/components/transition-link";
import { humanizeActionError, humanizeError } from "@/lib/humanize-error";
import {
  certificatePath,
  claimCertificate,
  getMyCertificate,
  type Course,
  type CourseCertificate,
} from "@/lib/api/courses";

/**
 * SHAN-720. On a certified course: what it takes to earn the certificate, the
 * claim once every lesson is done, and a link to it afterwards. The server
 * checks completion again on claim; this only decides what to offer.
 *
 * SHAN-721: a certificate course carries an exam, and `doneCount` counts it
 * only once passed.
 */
export function CertificatePanel({
  course,
  user,
  doneCount,
  total,
  progressKnown,
  hasExam,
}: {
  course: Course;
  /** Null while signed out or before hydration. */
  user: { name: string | null } | null;
  doneCount: number;
  total: number;
  /** False while progress is loading or failed to load. */
  progressKnown: boolean;
  hasExam: boolean;
}) {
  const [cert, setCert] = useState<CourseCertificate | null>(null);
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const allDone = progressKnown && total > 0 && doneCount === total;
  const left = total - doneCount;
  const andExam = hasExam ? " and pass the exam" : "";

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
          Finish every lesson{andExam} to earn a certificate signed by Shane. Sign in to claim it.
        </p>
      ) : !allDone ? (
        <p className="mt-1 text-sm text-gray-300">
          Finish all {total} lessons{andExam} to earn a certificate signed by Shane
          {progressKnown && doneCount > 0 ? (
            <span className="tabular-nums">
              {" "}
              ({left} to go)
            </span>
          ) : null}
          .
        </p>
      ) : checked ? (
        <form onSubmit={claim} className="mt-2 flex flex-wrap items-end gap-3">
          <p className="w-full text-sm text-gray-300">
            Every lesson is done{hasExam ? " and the exam is passed" : ""}. Choose the name to print on your
            certificate; it cannot be changed later.
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
    </section>
  );
}
