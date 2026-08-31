"use client";

import { useState } from "react";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { createCourse, type Course } from "@/lib/api/courses";

export function AddCourseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (course: Course) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    if (!url.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const course = await createCourse({
        url: url.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
      });
      setUrl("");
      setTitle("");
      onCreated(course);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add course");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <FocusTrappedDiv
        onKeyDown={(e) => {
          if (e.key === "Escape" && !submitting) onClose();
        }}
        className="w-full max-w-md space-y-4 rounded-lg border border-white/15 bg-gray-950 p-5"
      >
        <h2 className="text-lg font-semibold text-white">Add a course</h2>
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">Course URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://supermassive-courses-production.up.railway.app/courses/..."
            className="min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-gray-600 focus:border-white/40 focus:outline-none"
            autoFocus
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">Title (optional, AI suggests one)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white focus:border-white/40 focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="min-h-11 rounded-md bg-white/10 px-4 text-sm text-gray-200 hover:bg-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !url.trim()}
            className="min-h-11 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
          >
            {submitting ? "Classifying with AI..." : "Add course"}
          </button>
        </div>
        {submitting && (
          <p className="text-xs text-gray-500">
            Fetching the page and classifying it, this takes about ten seconds.
          </p>
        )}
      </FocusTrappedDiv>
    </div>
  );
}
