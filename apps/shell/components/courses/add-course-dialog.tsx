"use client";

import { useState } from "react";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { createCourse, validateContent, type Course, type CourseDifficulty } from "@/lib/api/courses";
import type { ContentIssue } from "@/lib/course-lessons";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { humanizeActionError } from "@/lib/humanize-error";
import { CATEGORY_STYLES } from "./category-styles";
import { STARTER_CONTENT } from "./lessons/starter-template";

/**
 * SHAN-617. Shared by the add and edit dialogs. For a deck, the second line is
 * there so "private" is not read as more than it is: it hides the course on
 * this site, but the deck is served by its own host, and that URL answers
 * anyone who has it. Lessons live on this site, so for them private is whole.
 */
export function PrivateCourseToggle({
  checked,
  onChange,
  deck = true,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  deck?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
      />
      <span className="space-y-1">
        <span className="block text-sm text-gray-200">Private</span>
        <span className="block text-xs text-gray-400">
          Only you and the site owner can see it. It stays off the catalog, the
          sitemap and search engines.
          {deck ? " The deck itself is still reachable by anyone who has its URL." : null}
        </span>
      </span>
    </label>
  );
}

type Mode = "lessons" | "deck";

const inputCls =
  "min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-gray-400 focus:border-white/40 focus:outline-none";

export function AddCourseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** `openEditor` = a lessons course, which should open straight in the editor. */
  onCreated: (course: Course, opts: { openEditor: boolean }) => void;
}) {
  const [mode, setMode] = useState<Mode>("lessons");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [difficulty, setDifficulty] = useState<CourseDifficulty>("intro");
  const [source, setSource] = useState<"example" | "file">("example");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [issues, setIssues] = useState<ContentIssue[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Before the early return: hooks must run on every render.
  useScrollLock(open);
  useEscapeKey(onClose, open && !submitting);

  if (!open) return null;

  const reset = () => {
    setUrl("");
    setTitle("");
    setDescription("");
    setFile(null);
    setIssues([]);
    setIsPrivate(false);
  };

  const canSubmit =
    !submitting &&
    (mode === "deck" ? !!url.trim() : !!title.trim() && (source === "example" || !!file));

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setIssues([]);
    try {
      if (mode === "deck") {
        const course = await createCourse({
          url: url.trim(),
          ...(title.trim() ? { title: title.trim() } : {}),
          visibility: isPrivate ? "private" : "public",
        });
        reset();
        onCreated(course, { openEditor: false });
        return;
      }
      let content: unknown = STARTER_CONTENT;
      if (source === "file" && file) {
        try {
          content = JSON.parse(file.text);
        } catch {
          setError(`${file.name} is not valid JSON.`);
          return;
        }
        // The server checks again on create; asking first lets us show every
        // issue with its path instead of one generic error.
        const check = await validateContent(file.text);
        if (!check.ok) {
          setIssues(check.issues);
          return;
        }
      }
      const course = await createCourse({
        title: title.trim(),
        description: description.trim() || null,
        category,
        difficulty,
        visibility: isPrivate ? "private" : "public",
        content,
      });
      reset();
      onCreated(course, { openEditor: true });
    } catch (e: unknown) {
      setError(humanizeActionError(e, "Failed to add course"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-course-heading"
    >
      <FocusTrappedDiv className="max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-lg border border-white/15 bg-gray-950 p-5">
        <h2 id="add-course-heading" className="text-lg font-semibold text-white">
          Add a course
        </h2>

        <div role="radiogroup" aria-label="Kind of course" className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1">
          {(
            [
              ["lessons", "Write lessons"],
              ["deck", "Link a deck"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-10 rounded-md text-sm transition-colors ${
                mode === m ? "bg-white text-black" : "text-gray-300 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-gray-400">
          {mode === "lessons"
            ? "Multiple choice, fill in the blank, ordering and matching, played right here. You write every answer; nothing is graded by AI."
            : "Register a slide deck hosted elsewhere. Its page is fetched and an AI model fills in the category and tags."}
        </p>

        {mode === "deck" ? (
          <>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Course URL</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://supermassive-courses-production.up.railway.app/courses/..."
                className={inputCls}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Title (optional, AI suggests one)</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
            </label>
          </>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">Title</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-400">One-line description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={2}
                className={`${inputCls} py-2`}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-gray-400">Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                  {Object.keys(CATEGORY_STYLES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
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
            <fieldset className="space-y-2">
              <legend className="text-xs text-gray-400">Start from</legend>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-200">
                <input
                  type="radio"
                  name="lesson-source"
                  checked={source === "example"}
                  onChange={() => setSource("example")}
                  className="h-4 w-4 accent-teal-400"
                />
                Example lessons to edit
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-200">
                <input
                  type="radio"
                  name="lesson-source"
                  checked={source === "file"}
                  onChange={() => setSource("file")}
                  className="h-4 w-4 accent-teal-400"
                />
                A course file (.json)
              </label>
              {source === "file" && (
                <input
                  type="file"
                  accept="application/json,.json"
                  aria-label="Course file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    setIssues([]);
                    setFile(f ? { name: f.name, text: await f.text() } : null);
                  }}
                  className="block w-full text-sm text-gray-300 file:mr-3 file:min-h-10 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:text-sm file:text-gray-100 hover:file:bg-white/20"
                />
              )}
            </fieldset>
          </>
        )}

        <PrivateCourseToggle checked={isPrivate} onChange={setIsPrivate} deck={mode === "deck"} />

        {issues.length > 0 && (
          <div role="alert" className="space-y-1 rounded-md border border-rose-400/20 bg-rose-400/[0.05] p-3 text-sm">
            <p className="text-rose-200">The file has {issues.length} issue{issues.length === 1 ? "" : "s"}:</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {issues.map((i, k) => (
                <li key={k} className="text-rose-100/90">
                  {i.path && <span className="font-mono text-xs text-rose-200/70">{i.path}: </span>}
                  {i.message}
                </li>
              ))}
            </ul>
          </div>
        )}
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
            disabled={!canSubmit}
            className="min-h-11 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
          >
            {submitting ? (mode === "deck" ? "Classifying with AI..." : "Creating...") : mode === "deck" ? "Add course" : "Create and edit"}
          </button>
        </div>
        {submitting && mode === "deck" && (
          <p className="text-xs text-gray-400">
            Fetching the page and classifying it, this takes about ten seconds.
          </p>
        )}
      </FocusTrappedDiv>
    </div>
  );
}
