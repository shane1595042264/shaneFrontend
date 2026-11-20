"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { humanizeActionError } from "@/lib/humanize-error";
import {
  getCourseReview,
  submitCourseReview,
  type Course,
  type CourseReview,
} from "@/lib/api/courses";

/**
 * SHAN-723. The lesson editor's Certificate tab: submit the course for
 * certification, wait for the reviewer, and read its feedback. A course is
 * certified only by passing this review; editing an approved course's lessons
 * sends it back, which the save response reports as `latest`.
 */

const POLL_MS = 5000;

export function CertificationReview({
  course,
  dirty,
  latest,
  onCertifiedChange,
}: {
  course: Course;
  /** Unsaved changes in the editor: the review reads the saved version. */
  dirty: boolean;
  /** A review queued by the last save, newer than anything loaded here. */
  latest: CourseReview | null;
  onCertifiedChange: (certified: boolean) => void;
}) {
  const [review, setReview] = useState<CourseReview | null>(null);
  const [certified, setCertified] = useState(course.certified);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const certifiedRef = useRef(course.certified);

  const load = useCallback(async () => {
    const r = await getCourseReview(course.id);
    setReview(r.review);
    setCertified(r.certified);
    if (certifiedRef.current !== r.certified) {
      certifiedRef.current = r.certified;
      onCertifiedChange(r.certified);
    }
    return r.review;
  }, [course.id, onCertifiedChange]);

  useEffect(() => {
    load()
      .catch((e: unknown) => setError(humanizeActionError(e, "Couldn't load the review")))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (latest) {
      setReview(latest);
      setCertified(false);
      certifiedRef.current = false;
    }
  }, [latest]);

  // The verdict lands a minute or so after submitting; check back until it does.
  const pending = review?.status === "pending";
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => {
      load().catch(() => {
        /* a missed poll is retried on the next tick */
      });
    }, POLL_MS);
    return () => clearInterval(t);
  }, [pending, load]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      setReview(await submitCourseReview(course.id));
    } catch (e: unknown) {
      setError(humanizeActionError(e, "Couldn't submit the course"));
      load().catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  const blocked =
    course.visibility === "private"
      ? "Make the course public before submitting it."
      : dirty
        ? "Save your changes first. The reviewer reads the saved version."
        : null;

  return (
    <div className="space-y-5 text-gray-300">
      <div>
        <p className="font-semibold text-white">Certification</p>
        <p className="mt-1 leading-relaxed text-gray-400">
          A certified course gives every learner who finishes it, passes its exam and its recall check a day later a
          certificate signed by Shane. To earn that, a reviewer reads the whole course and asks one question: could
          someone who finishes this call themselves top 1% in its topic?
        </p>
      </div>

      <div aria-live="polite" className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : certified ? (
          <p className="font-medium text-teal-300">Certified. This course issues certificates.</p>
        ) : !review ? (
          <p className="text-gray-400">Not submitted yet.</p>
        ) : review.status === "pending" ? (
          <p className="text-gray-200">
            In review. The reviewer is reading the course; this updates when it is done.
            {review.attempts > 1 && (
              <span className="mt-1 block text-xs text-gray-400">
                The reviewer has been unavailable, so it is being retried. Nothing is rejected because of that.
              </span>
            )}
          </p>
        ) : review.status === "approved" ? (
          <p className="text-gray-200">Approved, but the site owner withdrew the certification. Change the lessons and submit again.</p>
        ) : review.status === "rejected" ? (
          <p className="font-medium text-rose-200">Not certified yet.</p>
        ) : (
          <p className="text-gray-400">The lessons changed before that version was read. Submit again.</p>
        )}
        {review?.summary && review.status !== "pending" && (
          <p className="mt-2 leading-relaxed text-gray-300">{review.summary}</p>
        )}
        {review && review.status === "rejected" && review.feedback.length > 0 && (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">To get approved</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-gray-200">
              {review.feedback.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {review?.status === "rejected" && !review.current && (
          <p className="mt-3 text-xs text-gray-400">That feedback is about an earlier version of your lessons.</p>
        )}
      </div>

      {!certified && !pending && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || loading || !!blocked || (review?.status === "rejected" && review.current)}
            className="min-h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:bg-white/10 disabled:text-gray-400"
          >
            {submitting ? "Submitting..." : review ? "Submit again" : "Submit for certification"}
          </button>
          {blocked ? (
            <p className="text-xs text-gray-400">{blocked}</p>
          ) : review?.status === "rejected" && review.current ? (
            <p className="text-xs text-gray-400">Change the lessons using the feedback, save, then submit again.</p>
          ) : (
            <p className="text-xs text-gray-400">
              It needs at least one recite step and an exam lesson. The review takes about a minute.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-gray-400">
        Editing a certified course&apos;s lessons sends it back to review: it stops issuing certificates until the new
        version is approved. Certificates already issued stay valid.
      </p>
    </div>
  );
}
