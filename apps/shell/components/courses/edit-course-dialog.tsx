"use client";

import { useState } from "react";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { updateCourse, type Course, type CourseDifficulty } from "@/lib/api/courses";
import { CATEGORY_STYLES } from "./category-styles";

export function EditCourseDialog({
  open,
  course,
  onClose,
  onSaved,
}: {
  open: boolean;
  course: Course;
  onClose: () => void;
  onSaved: (course: Course) => void;
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [category, setCategory] = useState(course.category);
  const [difficulty, setDifficulty] = useState<CourseDifficulty>(course.difficulty);
  const [duration, setDuration] = useState(
    course.durationMinutes !== null ? String(course.durationMinutes) : "",
  );
  const [tags, setTags] = useState(course.tags.join(", "));
  const [url, setUrl] = useState(course.url);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const parsedDuration = duration.trim() === "" ? null : Number(duration);
      if (parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration < 1)) {
        throw new Error("Duration must be a whole number of minutes");
      }
      const updated = await updateCourse(course.id, {
        title: title.trim(),
        description: description.trim() || null,
        category,
        difficulty,
        durationMinutes: parsedDuration,
        tags: tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8),
        url: url.trim(),
      });
      onSaved(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white focus:border-white/40 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <FocusTrappedDiv
        onKeyDown={(e) => {
          if (e.key === "Escape" && !submitting) onClose();
        }}
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-lg border border-white/15 bg-gray-950 p-5"
      >
        <h2 className="text-lg font-semibold text-white">Edit course</h2>
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {Object.keys(CATEGORY_STYLES).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Difficulty</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as CourseDifficulty)}
              className={inputCls}
            >
              <option value="intro">intro</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Duration (minutes)</span>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Tags (comma-separated, max 8)</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">Course URL</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="min-h-11 rounded-md bg-white/10 px-4 text-sm text-gray-200 hover:bg-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !title.trim() || !url.trim()}
            className="min-h-11 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </FocusTrappedDiv>
    </div>
  );
}
