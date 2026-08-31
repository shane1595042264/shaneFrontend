"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listCourses, type Course } from "@/lib/api/courses";
import { InlineErrorState } from "@/components/inline-error-state";
import { CourseCard } from "./course-card";
import { AddCourseDialog } from "./add-course-dialog";
import { CATEGORY_STYLES, categoryStyle } from "./category-styles";

export function CoursesCatalog() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const load = () => {
    setError(null);
    listCourses()
      .then(setCourses)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load courses"),
      );
  };

  useEffect(load, []);

  const activeCategories = useMemo(() => {
    const present = new Set((courses ?? []).map((c) => c.category));
    return Object.keys(CATEGORY_STYLES).filter((k) => present.has(k));
  }, [courses]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return (courses ?? []).filter((c) => {
      if (category && c.category !== category) return false;
      if (!q) return true;
      const haystack = [c.title, c.description ?? "", c.category, ...c.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [courses, deferredQuery, category]);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <InlineErrorState message={error} onRetry={load} backHref="/" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Courses</h1>
          <p className="mt-1 text-sm text-gray-400">
            Interactive lectures, auto-classified by AI. Rate them, argue in the comments.
          </p>
        </div>
        {user && (
          <button
            onClick={() => setShowAdd(true)}
            className="min-h-11 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
          >
            + Add course
          </button>
        )}
      </div>

      {courses !== null && courses.length > 0 && (
        <div className="mb-6 space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, tags, category..."
            className="min-h-11 w-full max-w-sm rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-gray-600 focus:border-white/40 focus:outline-none"
            aria-label="Search courses"
          />
          {activeCategories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {activeCategories.map((cat) => {
                const s = categoryStyle(cat);
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(active ? null : cat)}
                    className={`rounded border px-2 py-1 text-xs ${s.border} ${active ? `${s.bg} ${s.text}` : "bg-transparent text-gray-400 hover:text-gray-200"}`}
                    aria-pressed={active}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {courses === null ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-white/10">
              <div className="aspect-video animate-pulse bg-white/10" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-black/20 p-8 text-center text-sm italic text-gray-500">
          The catalog is empty.{" "}
          {user ? "Register the first course above." : "Courses appear here once registered."}
        </p>
      ) : (
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </motion.ul>
      )}

      <AddCourseDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(course) => {
          setShowAdd(false);
          router.push(`/courses/${course.slug}`);
        }}
      />
    </main>
  );
}
