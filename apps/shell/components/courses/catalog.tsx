"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listCourses, type Course } from "@/lib/api/courses";
import { InlineErrorState } from "@/components/inline-error-state";
import { CourseCard } from "./course-card";
import { AddCourseDialog } from "./add-course-dialog";
import { CATEGORY_STYLES, categoryStyle } from "./category-styles";

// Matches the blog's cap on `q` (SHAN-493). Nothing here round-trips to the
// backend so an over-long value cannot 400, but an unbounded query string in
// the address bar is not worth carrying either.
const MAX_QUERY_LEN = 100;

type Filter = { category: string | null; q: string };

const EMPTY_FILTER: Filter = { category: null, q: "" };

/**
 * SHAN-498: the filter state lives in the URL so a filtered catalog can be
 * shared, bookmarked and backed out of.
 *
 * Read from `window.location` rather than `useSearchParams()`, for the same
 * reason blog-index.tsx does: `useSearchParams()` in a client component forces
 * the nearest Suspense boundary to render its fallback during prerender, and
 * /courses is prerendered. The native history API leaves the prerender alone.
 */
function readFilter(): Filter {
  if (typeof window === "undefined") return EMPTY_FILTER;
  const params = new URLSearchParams(window.location.search);
  return {
    category: params.get("category")?.trim() || null,
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LEN),
  };
}

/** Rewrites `category`/`q` in place, leaving any other query param alone. */
function writeFilter(category: string | null, q: string, mode: "push" | "replace") {
  const params = new URLSearchParams(window.location.search);
  if (category) params.set("category", category);
  else params.delete("category");
  const trimmed = q.trim();
  if (trimmed) params.set("q", trimmed);
  else params.delete("q");
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  // Re-clicking the active chip would otherwise stack identical entries and
  // make Back look broken.
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

export function CoursesCatalog() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Seeded from the URL so a deep link arrives filtered, with no flash of the
  // unfiltered grid. readFilter() is SSR-safe and yields the empty filter
  // during prerender, which is what the server would have rendered anyway.
  const [query, setQuery] = useState(() => readFilter().q);
  const [category, setCategory] = useState<string | null>(() => readFilter().category);
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

  const applyFilter = useCallback(({ category: cat, q }: Filter) => {
    setCategory(cat);
    setQuery(q);
  }, []);

  // Back/Forward across the entries pushed by writeFilter.
  useEffect(() => {
    const onPopState = () => applyFilter(readFilter());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyFilter]);

  const clearFilters = () => {
    applyFilter(EMPTY_FILTER);
    writeFilter(null, "", "push");
  };

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
            onChange={(e) => {
              setQuery(e.target.value);
              // replaceState, not push: one history entry per keystroke would
              // bury the page the reader arrived from.
              writeFilter(category, e.target.value, "replace");
            }}
            placeholder="Search title, tags, category..."
            maxLength={MAX_QUERY_LEN}
            className="min-h-11 w-full max-w-sm rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-gray-400 focus:border-white/40 focus:outline-none"
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
                    onClick={() => {
                      const next = active ? null : cat;
                      setCategory(next);
                      // pushState: picking a category is a destination worth a
                      // Back entry, unlike a keystroke in the search box.
                      writeFilter(next, query, "push");
                    }}
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
        <p className="rounded-lg border border-white/10 bg-black/20 p-8 text-center text-sm italic text-gray-400">
          The catalog is empty.{" "}
          {user ? "Register the first course above." : "Courses appear here once registered."}
        </p>
      ) : filtered.length === 0 ? (
        // SHAN-498: a filtered-to-nothing catalog used to fall through to the
        // grid below and render zero cards, leaving the page blank with no hint
        // that a filter was responsible. The clear button matters more here
        // than on the blog: the category chips only render when the catalog has
        // more than one category, so a ?category= that matches nothing would
        // otherwise be unclearable from the UI.
        <div className="rounded-lg border border-white/10 bg-black/20 p-8 text-center">
          <p className="text-sm italic text-gray-400">No courses match that filter.</p>
          <button
            onClick={clearFilters}
            className="mt-4 min-h-11 rounded-md border border-white/15 px-4 text-sm text-gray-200 transition-colors hover:bg-white/5"
          >
            Clear filters
          </button>
        </div>
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
