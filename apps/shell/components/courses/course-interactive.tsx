"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  clearCourseRating,
  deleteCourse,
  getCourse,
  rateCourse,
  reclassifyCourse,
  removeCourseCover,
  uploadCourseCover,
  type Course,
} from "@/lib/api/courses";
import { categoryStyle, DIFFICULTY_STYLES } from "./category-styles";
import { GeneratedCover } from "./generated-cover";
import { StarRating } from "./star-rating";
import { EditCourseDialog } from "./edit-course-dialog";
import { CourseCommentsThread } from "./comments-thread";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

export function CourseInteractive({ initialCourse }: { initialCourse: Course }) {
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState(initialCourse);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [adminBusy, setAdminBusy] = useState<string | null>(null);

  const isOwner = !!user && user.id === course.ownerId;
  const style = categoryStyle(course.category);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = async () => {
    try {
      setCourse(await getCourse(course.slug));
    } catch {
      /* keep current state */
    }
  };

  const handleRate = async (stars: number) => {
    if (!user || ratingBusy) return;
    const prev = course;
    setRatingBusy(true);
    setCourse({ ...course, myStars: stars });
    try {
      const rating = await rateCourse(course.id, stars);
      setCourse((c) => ({
        ...c,
        myStars: rating.mine,
        rating: { average: rating.average, count: rating.count },
      }));
    } catch (e: unknown) {
      setCourse(prev);
      flash(e instanceof Error ? e.message : "Rating failed");
    } finally {
      setRatingBusy(false);
    }
  };

  const handleClearRating = async () => {
    if (!user || ratingBusy) return;
    const prev = course;
    setRatingBusy(true);
    setCourse({ ...course, myStars: null });
    try {
      const rating = await clearCourseRating(course.id);
      setCourse((c) => ({
        ...c,
        myStars: null,
        rating: { average: rating.average, count: rating.count },
      }));
    } catch (e: unknown) {
      setCourse(prev);
      flash(e instanceof Error ? e.message : "Rating failed");
    } finally {
      setRatingBusy(false);
    }
  };

  const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      flash("Cover too large (max 5MB)");
      return;
    }
    setAdminBusy("cover");
    try {
      await uploadCourseCover(course.id, file);
      await refresh();
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAdminBusy(null);
    }
  };

  const handleRemoveCover = async () => {
    setAdminBusy("cover");
    try {
      await removeCourseCover(course.id);
      await refresh();
      router.refresh();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Failed to remove cover");
    } finally {
      setAdminBusy(null);
    }
  };

  const handleReclassify = async () => {
    setAdminBusy("reclassify");
    try {
      setCourse(await reclassifyCourse(course.id));
      flash("Reclassified.");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Reclassify failed");
    } finally {
      setAdminBusy(null);
    }
  };

  const handleDelete = async () => {
    setAdminBusy("delete");
    try {
      await deleteCourse(course.id);
      router.push("/courses");
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : "Delete failed");
      setAdminBusy(null);
      setShowDelete(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16">
      <nav className="flex items-center gap-3 py-4 text-sm">
        <Link href="/courses" className="text-gray-500 hover:text-gray-300">
          &larr; Courses
        </Link>
      </nav>

      {/* Hero */}
      <div className={`relative aspect-[2/1] overflow-hidden rounded-xl border ${style.border}`}>
        {course.coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={course.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          </>
        ) : (
          <GeneratedCover
            title={course.title}
            category={course.category}
            slug={course.slug}
            hideTitle
          />
        )}
        <div className="absolute inset-x-0 bottom-0 space-y-3 p-6">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white drop-shadow sm:text-4xl">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded border px-1.5 py-0.5 ${style.border} ${style.bg} ${style.text}`}>
              {course.category}
            </span>
            <span className={`rounded border px-1.5 py-0.5 ${DIFFICULTY_STYLES[course.difficulty] ?? DIFFICULTY_STYLES.intermediate}`}>
              {course.difficulty}
            </span>
            {course.durationMinutes !== null && (
              <span className="rounded border border-white/20 px-1.5 py-0.5 text-gray-200">
                {course.durationMinutes} min
              </span>
            )}
            {course.tags.map((t) => (
              <span key={t} className="rounded border border-white/10 px-1.5 py-0.5 text-gray-400">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA + rating */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <a
          href={course.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-11 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200"
        >
          Launch course
        </a>
        <div className="flex flex-col items-end gap-1">
          <StarRating
            average={course.rating.average}
            count={course.rating.count}
            mine={course.myStars}
            canRate={!!user}
            busy={ratingBusy}
            onRate={handleRate}
            onClear={handleClearRating}
          />
          {!user && <span className="text-xs text-gray-500">Sign in to rate</span>}
        </div>
      </div>

      {course.description && (
        <p className="mt-6 text-sm leading-relaxed text-gray-300">{course.description}</p>
      )}

      {toast && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {toast}
        </p>
      )}

      {/* Admin toolbar */}
      {isOwner && (
        <div className="mt-6 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
          <button
            onClick={() => setShowEdit(true)}
            className="min-h-11 rounded-md bg-white/10 px-3 text-sm text-gray-200 hover:bg-white/20"
          >
            Edit
          </button>
          <button
            onClick={handleReclassify}
            disabled={adminBusy !== null}
            className="min-h-11 rounded-md bg-white/10 px-3 text-sm text-gray-200 hover:bg-white/20 disabled:opacity-50"
          >
            {adminBusy === "reclassify" ? "Reclassifying..." : "Reclassify with AI"}
          </button>
          <label className="flex min-h-11 cursor-pointer items-center rounded-md bg-white/10 px-3 text-sm text-gray-200 hover:bg-white/20">
            {adminBusy === "cover" ? "Working..." : course.coverUrl ? "Replace cover" : "Upload cover"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleCoverPick}
              className="sr-only"
              disabled={adminBusy !== null}
            />
          </label>
          {course.coverUrl && (
            <button
              onClick={handleRemoveCover}
              disabled={adminBusy !== null}
              className="min-h-11 rounded-md bg-white/10 px-3 text-sm text-gray-200 hover:bg-white/20 disabled:opacity-50"
            >
              Remove cover
            </button>
          )}
          <button
            onClick={() => setShowDelete(true)}
            disabled={adminBusy !== null}
            className="min-h-11 rounded-md bg-red-950/60 px-3 text-sm text-red-300 hover:bg-red-900/60 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}

      {/* Comments (thread renders its own heading with a live count) */}
      <CourseCommentsThread courseId={course.id} courseOwnerId={course.ownerId} />

      {showEdit && (
        <EditCourseDialog
          key={course.updatedAt}
          open={showEdit}
          course={course}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setCourse(updated);
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <FocusTrappedDiv className="w-full max-w-sm space-y-4 rounded-lg border border-white/15 bg-gray-950 p-5">
            <p className="text-sm text-gray-200">
              Delete &quot;{course.title}&quot;? Ratings and comments go with it.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDelete(false)}
                disabled={adminBusy === "delete"}
                className="min-h-11 rounded-md bg-white/10 px-4 text-sm text-gray-200 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={adminBusy === "delete"}
                className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {adminBusy === "delete" ? "Deleting..." : "Delete"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </main>
  );
}
