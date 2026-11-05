"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { humanizeActionError } from "@/lib/humanize-error";
import {
  ContentInvalidError,
  saveCourseContent,
  validateContent,
  type Course,
} from "@/lib/api/courses";
import {
  exerciseCount,
  type ContentIssue,
  type ContentStats,
  type CourseContent,
  type CourseLesson,
} from "@/lib/course-lessons";
import { LessonPlayer } from "./lesson-player";
import { STARTER_CONTENT, STEP_SNIPPETS } from "./starter-template";

/**
 * SHAN-652. Where an author writes a course's lessons: the JSON document on
 * the left, checked by the server's own validator as they type, and on the
 * right an outline with a preview for every lesson, the issues (click one to
 * jump to it), structural "add" buttons, and the API call that does the same
 * upload from a script.
 *
 * A draft survives a reload in localStorage until it is saved or discarded.
 */

type Check =
  | { kind: "checking" }
  | { kind: "ok"; content: CourseContent; stats: ContentStats }
  | { kind: "invalid"; issues: ContentIssue[] }
  | { kind: "error"; message: string };

type Tab = "outline" | "issues" | "add" | "api";

const DRAFT_KEY = (courseId: string) => `shane:course-draft:${courseId}`;
const LINE_HEIGHT = 24;

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

function readDraft(courseId: string): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY(courseId));
  } catch {
    return null;
  }
}

function writeDraft(courseId: string, text: string | null) {
  try {
    if (text === null) localStorage.removeItem(DRAFT_KEY(courseId));
    else localStorage.setItem(DRAFT_KEY(courseId), text);
  } catch {
    /* storage blocked: the draft just does not survive a reload */
  }
}

/** JSON.parse's own error, turned into a 1-based line and column. */
function syntaxIssue(text: string): { message: string; pos: number } | null {
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    const m = msg.match(/position (\d+)/);
    const pos = m ? Number(m[1]) : text.length;
    return { message: msg.replace(/^JSON\.parse: /, ""), pos };
  }
}

function lineCol(text: string, pos: number): { line: number; col: number } {
  const before = text.slice(0, pos).split("\n");
  return { line: before.length, col: before[before.length - 1].length + 1 };
}

function parsePath(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const m of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) out.push(m[2] !== undefined ? Number(m[2]) : m[1]);
  return out;
}

/**
 * Where a validator path ("units[0].lessons[2].steps[1].choices") starts in
 * the source text, by walking the JSON the way a parser would. Falls back to
 * the deepest part of the path that exists, so "add a field here" issues
 * still land on the right object.
 */
function locate(text: string, target: (string | number)[]): number | null {
  let i = 0;
  let best: { len: number; pos: number } | null = null;
  let found: number | null = null;
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const str = () => {
    let out = "";
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") {
        out += text[i + 1];
        i += 2;
      } else out += text[i++];
    }
    i++;
    return out;
  };
  const value = (path: (string | number)[]): void => {
    ws();
    if (found !== null || i >= text.length) return;
    if (path.every((p, k) => p === target[k])) {
      if (path.length === target.length) {
        found = i;
        return;
      }
      if (!best || path.length > best.len) best = { len: path.length, pos: i };
    }
    const c = text[i];
    if (c === "{") {
      i++;
      ws();
      if (text[i] === "}") {
        i++;
        return;
      }
      while (i < text.length) {
        ws();
        if (text[i] !== '"') return;
        const key = str();
        ws();
        if (text[i] !== ":") return;
        i++;
        value([...path, key]);
        if (found !== null) return;
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") i++;
        return;
      }
    } else if (c === "[") {
      i++;
      ws();
      if (text[i] === "]") {
        i++;
        return;
      }
      let k = 0;
      while (i < text.length) {
        value([...path, k++]);
        if (found !== null) return;
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") i++;
        return;
      }
    } else if (c === '"') str();
    else while (i < text.length && !/[,\]}\s]/.test(text[i])) i++;
  };
  value([]);
  return found ?? (best as { len: number; pos: number } | null)?.pos ?? null;
}

export function LessonEditor({
  course,
  initial,
  onClose,
  onSaved,
}: {
  course: Course;
  initial: CourseContent | null;
  onClose: () => void;
  onSaved: (content: CourseContent, course: Course) => void;
}) {
  useScrollLock(true);
  const baseline = useMemo(() => pretty(initial ?? STARTER_CONTENT), [initial]);
  const [text, setText] = useState(baseline);
  const [savedText, setSavedText] = useState(initial ? baseline : "");
  const [restored, setRestored] = useState(false);
  const [check, setCheck] = useState<Check>({ kind: "checking" });
  const [lastGood, setLastGood] = useState<{ content: CourseContent; stats: ContentStats } | null>(null);
  const [tab, setTab] = useState<Tab>("outline");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [preview, setPreview] = useState<{ lesson: CourseLesson; unit: string; index: number; total: number; run: number } | null>(null);
  const [addTo, setAddTo] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = text !== savedText;
  const syntax = useMemo(() => syntaxIssue(text), [text]);
  const lineCount = useMemo(() => text.split("\n").length, [text]);

  // Restore an unsaved draft once, on open.
  useEffect(() => {
    const draft = readDraft(course.id);
    if (draft && draft !== baseline) {
      setText(draft);
      setRestored(true);
    }
  }, [course.id, baseline]);

  useEffect(() => {
    writeDraft(course.id, dirty ? text : null);
  }, [course.id, text, dirty]);

  // Server-side validation, debounced; the server's validator is the one the
  // upload will face, so the editor never disagrees with the API.
  useEffect(() => {
    if (syntax) return;
    setCheck({ kind: "checking" });
    let cancelled = false;
    const t = setTimeout(() => {
      validateContent(text)
        .then((r) => {
          if (cancelled) return;
          if (r.ok) {
            setCheck({ kind: "ok", content: r.content, stats: r.stats });
            setLastGood({ content: r.content, stats: r.stats });
          } else setCheck({ kind: "invalid", issues: r.issues });
        })
        .catch((e: unknown) => {
          if (!cancelled) setCheck({ kind: "error", message: humanizeActionError(e, "Could not check") });
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, syntax]);

  const jumpTo = useCallback((pos: number) => {
    const area = areaRef.current;
    if (!area) return;
    const value = area.value;
    const start = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
    const nl = value.indexOf("\n", pos);
    const end = nl === -1 ? value.length : nl;
    area.focus();
    area.setSelectionRange(start, end);
    const line = value.slice(0, start).split("\n").length - 1;
    area.scrollTop = Math.max(0, line * LINE_HEIGHT - area.clientHeight / 3);
  }, []);

  const save = useCallback(async () => {
    if (saving || syntax || check.kind !== "ok") return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveCourseContent(course.id, text);
      const normalized = pretty(res.content);
      setText(normalized);
      setSavedText(normalized);
      writeDraft(course.id, null);
      setRestored(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2200);
      onSaved(res.content, res.course);
    } catch (e: unknown) {
      if (e instanceof ContentInvalidError) {
        setCheck({ kind: "invalid", issues: e.issues });
        setTab("issues");
      } else setSaveError(humanizeActionError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  }, [saving, syntax, check.kind, course.id, text, onSaved]);

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  const onAreaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      // Indent instead of leaving the editor. Escape then Tab still leaves.
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: a, selectionEnd: b } = el;
      const next = text.slice(0, a) + "  " + text.slice(b);
      setText(next);
      requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
    }
  };

  // Structural edits work on the parsed document, so they cannot break the
  // JSON the way pasting a snippet into the wrong spot can.
  const mutate = (fn: (doc: { units: { title: string; lessons: { title: string; steps: unknown[] }[] }[] }) => void) => {
    if (syntax) return;
    const doc = JSON.parse(text);
    if (!doc || !Array.isArray(doc.units)) return;
    fn(doc);
    setText(pretty(doc));
  };

  const lessonsForAdd = useMemo(() => {
    if (syntax) return [];
    try {
      const doc = JSON.parse(text) as { units?: { title?: string; lessons?: { title?: string }[] }[] };
      return (doc.units ?? []).flatMap((u, ui) =>
        (u.lessons ?? []).map((l, li) => ({ ui, li, label: `${u.title ?? `Unit ${ui + 1}`} / ${l.title ?? `Lesson ${li + 1}`}` })),
      );
    } catch {
      return [];
    }
  }, [text, syntax]);

  const addStep = (kind: string) =>
    mutate((doc) => {
      const target = lessonsForAdd[addTo] ?? lessonsForAdd[0];
      if (!target) return;
      doc.units[target.ui].lessons[target.li].steps.push(structuredClone(STEP_SNIPPETS[kind]));
    });

  const issues: { message: string; path: string; pos: number | null }[] = syntax
    ? [{ message: syntax.message, path: (() => { const lc = lineCol(text, syntax.pos); return `line ${lc.line}, column ${lc.col}`; })(), pos: syntax.pos }]
    : check.kind === "invalid"
      ? check.issues.map((i) => ({ ...i, pos: locate(text, parsePath(i.path)) }))
      : [];

  const status = syntax
    ? { tone: "bad", text: "JSON syntax error" }
    : check.kind === "ok"
      ? { tone: "good", text: `${check.stats.lessons} lessons, ${check.stats.exercises} exercises, about ${check.stats.estimatedMinutes} min` }
      : check.kind === "invalid"
        ? { tone: "bad", text: `${check.issues.length} issue${check.issues.length === 1 ? "" : "s"}` }
        : check.kind === "error"
          ? { tone: "bad", text: check.message }
          : { tone: "idle", text: "Checking..." };

  const outline = lastGood?.content;
  const apiBase = "https://shanejli.com/api/courses";

  const tabs: { id: Tab; label: string }[] = [
    { id: "outline", label: "Outline" },
    { id: "issues", label: issues.length ? `Issues ${issues.length}` : "Issues" },
    { id: "add", label: "Add" },
    { id: "api", label: "API" },
  ];

  return (
    <FocusTrappedDiv
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-editor-heading"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !preview) {
          e.preventDefault();
          if (confirmClose) setConfirmClose(false);
          else requestClose();
        }
      }}
      className="fixed inset-0 z-[60] flex flex-col bg-black text-gray-100"
    >
      <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2">
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close the lesson editor"
          className="grid h-10 w-10 place-items-center rounded-lg text-2xl leading-none text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <span aria-hidden="true">&times;</span>
        </button>
        <div className="min-w-0 flex-1">
          <h2 id="lesson-editor-heading" className="truncate text-[15px] font-semibold text-white">
            Lessons for {course.title}
          </h2>
          <p
            aria-live="polite"
            className={`truncate text-xs ${
              status.tone === "good" ? "text-teal-300" : status.tone === "bad" ? "text-rose-300" : "text-gray-400"
            }`}
          >
            {status.text}
            {dirty ? <span className="text-gray-400">. Unsaved changes</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => !syntax && setText(pretty(JSON.parse(text)))}
            disabled={!!syntax}
            className="hidden min-h-10 rounded-lg px-3 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] disabled:opacity-40 sm:block"
          >
            Format
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-10 rounded-lg px-3 text-sm text-gray-300 transition-colors hover:bg-white/[0.06]"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setText(await f.text());
            }}
          />
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([text], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${course.slug}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            className="hidden min-h-10 rounded-lg px-3 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] sm:block"
          >
            Download
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !!syntax || check.kind !== "ok" || !dirty}
            className="min-h-10 min-w-24 rounded-lg bg-white px-4 text-sm font-semibold text-black transition-[transform,background-color] hover:bg-gray-200 active:translate-y-px disabled:bg-white/10 disabled:text-gray-400"
          >
            {saving ? "Saving..." : justSaved ? "Saved" : "Save"}
          </button>
        </div>
      </header>

      {(restored || saveError) && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-amber-400/[0.06] px-4 py-2 text-sm">
          {saveError ? (
            <span role="alert" className="text-rose-300">
              {saveError}
            </span>
          ) : (
            <>
              <span className="text-amber-100/90">Restored your unsaved draft from this browser.</span>
              <button
                type="button"
                onClick={() => {
                  setText(baseline);
                  setRestored(false);
                }}
                className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              >
                Discard it
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,0.8fr)] md:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] md:grid-rows-1">
        <div className="relative flex min-h-0 overflow-hidden bg-gray-950">
          <div
            aria-hidden="true"
            className="pointer-events-none w-12 shrink-0 select-none overflow-hidden border-r border-white/[0.06] py-4 pr-3 text-right font-mono text-xs text-gray-400"
          >
            <div ref={gutterRef}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onAreaKey}
            onScroll={(e) => {
              if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`;
            }}
            aria-label="Course lessons, JSON"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            wrap="off"
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-[13px] text-gray-100 outline-none [tab-size:2]"
          />
        </div>

        <aside className="flex min-h-0 flex-col border-t border-white/10 md:border-l md:border-t-0">
          <div role="tablist" aria-label="Editor panels" className="flex shrink-0 gap-1 border-b border-white/10 px-2 pt-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-10 rounded-t-lg px-3 text-sm transition-colors ${
                  tab === t.id ? "bg-white/[0.07] text-white" : "text-gray-400 hover:text-gray-200"
                } ${t.id === "issues" && issues.length ? "text-rose-300" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
            {tab === "outline" &&
              (outline ? (
                <div className="space-y-6">
                  {check.kind !== "ok" && (
                    <p className="text-xs text-gray-400">Showing the last valid version while you fix the issues.</p>
                  )}
                  {outline.units.map((u, ui) => (
                    <div key={u.id}>
                      <p className="font-semibold text-white">{u.title}</p>
                      <p className="font-mono text-xs text-gray-400">{u.id}</p>
                      <ul className="mt-2 space-y-1">
                        {u.lessons.map((l) => {
                          const all = outline.units.flatMap((x) => x.lessons);
                          const index = all.findIndex((x) => x.id === l.id);
                          return (
                            <li key={l.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-gray-200">{l.title}</span>
                                <span className="block text-xs text-gray-400">
                                  {l.steps.length} steps, {exerciseCount(l)} exercises
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreview({ lesson: l, unit: u.title, index, total: all.length, run: Date.now() })
                                }
                                className="min-h-9 shrink-0 rounded-lg bg-white/[0.07] px-3 text-xs text-gray-100 transition-colors hover:bg-white/[0.14]"
                              >
                                Preview
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {ui === outline.units.length - 1 ? null : <div className="mt-6 h-px bg-white/[0.06]" />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">The outline appears once the document is valid.</p>
              ))}

            {tab === "issues" &&
              (issues.length === 0 ? (
                <p className="text-gray-400">No issues. {check.kind === "ok" ? "Ready to save." : ""}</p>
              ) : (
                <ul className="space-y-2">
                  {issues.map((i, k) => (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => i.pos !== null && jumpTo(i.pos)}
                        className="w-full rounded-lg border border-rose-400/20 bg-rose-400/[0.05] px-3 py-2 text-left transition-colors hover:border-rose-400/40"
                      >
                        <span className="block text-rose-100">{i.message}</span>
                        {i.path && <span className="mt-0.5 block font-mono text-xs text-rose-200/60">{i.path}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === "add" && (
              <div className="space-y-6">
                {syntax ? (
                  <p className="text-gray-400">Fix the JSON syntax error first.</p>
                ) : (
                  <>
                    <div>
                      <label htmlFor="add-to-lesson" className="text-xs text-gray-400">
                        Add a step to
                      </label>
                      <select
                        id="add-to-lesson"
                        value={addTo}
                        onChange={(e) => setAddTo(Number(e.target.value))}
                        className="mt-1 min-h-10 w-full rounded-lg border border-white/15 bg-gray-950 px-2 text-sm text-gray-100"
                      >
                        {lessonsForAdd.map((l, i) => (
                          <option key={i} value={i}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          ["teach", "Teach card"],
                          ["choice", "Multiple choice"],
                          ["blank", "Typed blank"],
                          ["bank", "Word bank"],
                          ["order", "Put in order"],
                          ["match", "Match pairs"],
                        ].map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => addStep(k)}
                            disabled={lessonsForAdd.length === 0}
                            className="min-h-10 rounded-lg border border-white/10 px-3 text-left text-sm text-gray-200 transition-colors hover:border-white/25 hover:bg-white/[0.04] disabled:opacity-40"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          mutate((doc) => {
                            const u = doc.units[lessonsForAdd[addTo]?.ui ?? doc.units.length - 1];
                            u?.lessons.push({ title: "New lesson", steps: [structuredClone(STEP_SNIPPETS.choice)] });
                          })
                        }
                        className="min-h-10 rounded-lg bg-white/[0.07] px-3 text-sm text-gray-100 hover:bg-white/[0.14]"
                      >
                        Add a lesson
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          mutate((doc) => {
                            doc.units.push({
                              title: "New unit",
                              lessons: [{ title: "New lesson", steps: [structuredClone(STEP_SNIPPETS.choice)] }],
                            });
                          })
                        }
                        className="min-h-10 rounded-lg bg-white/[0.07] px-3 text-sm text-gray-100 hover:bg-white/[0.14]"
                      >
                        Add a unit
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-400">
                      Ids are filled in from titles when you save. Once learners have started, keep a lesson&apos;s id
                      when you rename it, or their progress on it is dropped.
                    </p>
                  </>
                )}
              </div>
            )}

            {tab === "api" && (
              <div className="space-y-4 text-gray-300">
                <p>
                  The same document can be uploaded from a script with a personal access token that has{" "}
                  <code className="rounded bg-white/[0.08] px-1 font-mono text-xs">entries:write</code>.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-gray-950 p-3 font-mono text-xs leading-5 text-gray-200">
{`curl -X PUT ${apiBase}/${course.id}/content \\
  -H "Authorization: Bearer $PAT" \\
  -H "Content-Type: application/json" \\
  --data @${course.slug}.json`}
                </pre>
                <p>Check a document without saving it:</p>
                <pre className="overflow-x-auto rounded-lg bg-gray-950 p-3 font-mono text-xs leading-5 text-gray-200">
{`curl -X POST ${apiBase}/content/validate \\
  -H "Authorization: Bearer $PAT" \\
  -H "Content-Type: application/json" \\
  --data @${course.slug}.json`}
                </pre>
                <p>
                  Tokens are made at{" "}
                  <a href="/settings/tokens" className="text-teal-300 underline underline-offset-2">
                    settings
                  </a>
                  . The full format is in the{" "}
                  <a href="/docs/courses-api#lessons" className="text-teal-300 underline underline-offset-2">
                    Courses API docs
                  </a>
                  .
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {confirmClose && (
        <div className="fixed inset-0 z-[61] flex items-end justify-center bg-black/70 p-4 md:items-center">
          <div role="alertdialog" aria-labelledby="close-editor-heading" className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-950 p-5">
            <h3 id="close-editor-heading" className="text-lg font-semibold text-white">
              Close without saving?
            </h3>
            <p className="mt-1 text-sm text-gray-400">Your draft stays in this browser and comes back next time.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmClose(false)}
                className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-gray-200"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-lg bg-white/[0.08] px-4 text-sm text-gray-200 hover:bg-white/[0.14]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rendered inside the editor's own stacking context, so it covers it. */}
      {preview && (
        <>
          <LessonPlayer
            key={preview.run}
            lesson={preview.lesson}
            unitTitle={preview.unit}
            position={{ index: preview.index, total: preview.total }}
            next={null}
            onExit={() => setPreview(null)}
            onNext={() => setPreview(null)}
            onFinish={async () => "preview"}
          />
        </>
      )}
    </FocusTrappedDiv>
  );
}
