"use client";

import { useEffect, useState } from "react";
import Link from "@/components/transition-link";
import { useParams } from "next/navigation";
import { useTransitionRouter as useRouter } from "@/lib/view-transition";
import { useAuth } from "@/lib/auth-context";
import { CourseInteractive } from "@/components/courses/course-interactive";
import { coursePath, findCourse, type Course } from "@/lib/api/courses";

/**
 * SHAN-617. Where a private course is read.
 *
 * Why it is not /courses/<slug>: middleware HEADs that path's course
 * anonymously (the JWT lives in localStorage, so the edge has no identity to
 * forward), and the backend answers a private course with a 404 to anyone
 * without the creator's or the site owner's token. So the creator would get a
 * hard 404 before Next rendered anything. This is a two-segment path the
 * middleware slug branch cannot match, fetched client-side with the reader's
 * token, the same answer the blog gave its drafts with /blog/preview/<slug>
 * (SHAN-487).
 *
 * A course made public in the meantime is sent to its real, cacheable URL.
 */
export default function PrivateCoursePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth: fetching before the token is readable would ask
    // anonymously and get the 404 this page exists to avoid.
    if (authLoading) return;
    let cancelled = false;
    setState("loading");
    findCourse(slug)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setState("missing");
          return;
        }
        if (data.visibility !== "private") {
          router.replace(coursePath(data));
          return;
        }
        setCourse(data);
        setState("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load this course");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, authLoading, router]);

  if (authLoading || state === "loading") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10" aria-busy={true}>
        <div role="status" aria-label="Loading course">
          <span className="sr-only">Loading course…</span>
          <div className="aspect-[2/1] animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="mt-6 h-11 w-36 animate-pulse rounded-md bg-white/[0.08]" />
        </div>
      </div>
    );
  }

  if (state !== "ready" || !course) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-sm text-gray-400">
        <Link href="/courses" className="text-gray-400 hover:text-white">
          &larr; Back to courses
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-white">Course not found</h1>
        <p className="mt-2">
          {state === "missing"
            ? user
              ? "No such course, or it is private to someone else."
              : "No such course. If this is your private course, sign in to see it."
            : (error ?? "Failed to load this course.")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <CourseInteractive initialCourse={course} />
    </div>
  );
}
