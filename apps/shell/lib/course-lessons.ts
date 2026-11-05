/**
 * SHAN-652. Types and grading for interactive course lessons.
 *
 * The format itself is validated by the backend (shaneBackend
 * src/modules/courses/content-schema.ts), which is the one source of truth:
 * the editor sends drafts to POST /api/courses/content/validate rather than
 * re-implementing the rules here. What lives here is what the player needs to
 * grade an answer, and grading is plain comparison against the author's
 * answer. No model is involved anywhere.
 */

export interface TeachStep {
  type: "teach";
  title?: string;
  body: string;
  code?: string;
  language?: string;
}

interface Graded {
  code?: string;
  language?: string;
  explanation?: string;
}

export interface ChoiceStep extends Graded {
  type: "choice";
  prompt: string;
  choices: { text: string; correct?: boolean; why?: string }[];
}

export interface BlankStep extends Graded {
  type: "blank";
  prompt?: string;
  /** Blanks are written inline as [[answer|alternative]]. */
  text: string;
  /** Present = word-bank mode with these distractors. */
  bank?: string[];
}

export interface OrderStep extends Graded {
  type: "order";
  prompt: string;
  /** In the correct order. */
  items: string[];
}

export interface MatchStep extends Graded {
  type: "match";
  prompt?: string;
  pairs: [string, string][];
}

export type CourseStep = TeachStep | ChoiceStep | BlankStep | OrderStep | MatchStep;
export type GradedStep = Exclude<CourseStep, TeachStep>;

export interface CourseLesson {
  id: string;
  title: string;
  summary?: string;
  steps: CourseStep[];
}

export interface CourseUnit {
  id: string;
  title: string;
  summary?: string;
  lessons: CourseLesson[];
}

export interface CourseContent {
  version: 1;
  units: CourseUnit[];
}

export interface ContentStats {
  units: number;
  lessons: number;
  steps: number;
  exercises: number;
  estimatedMinutes: number;
}

export interface ContentIssue {
  path: string;
  message: string;
}

export interface CourseProgress {
  lessonId: string;
  bestScore: number;
  lastScore: number;
  attempts: number;
  completedAt: string;
  updatedAt: string;
}

export const isGraded = (s: CourseStep): s is GradedStep => s.type !== "teach";

export function exerciseCount(lesson: CourseLesson): number {
  return lesson.steps.filter(isGraded).length;
}

export function lessonMinutes(lesson: CourseLesson): number {
  const ex = exerciseCount(lesson);
  return Math.max(1, Math.round(((lesson.steps.length - ex) * 20 + ex * 30) / 60));
}

/** Every lesson in reading order, with its unit. */
export function flatLessons(content: CourseContent): { unit: CourseUnit; lesson: CourseLesson; index: number }[] {
  const out: { unit: CourseUnit; lesson: CourseLesson; index: number }[] = [];
  for (const unit of content.units) {
    for (const lesson of unit.lessons) out.push({ unit, lesson, index: out.length });
  }
  return out;
}

// ---- blanks -----------------------------------------------------------------

const BLANK_RE = /\[\[([^\[\]]+)\]\]/g;

export type BlankPart = { kind: "text"; value: string } | { kind: "blank"; index: number; answers: string[] };

/** "To the [[collector|the collector]]." -> text, blank, text. Mirrors the backend. */
export function parseBlankText(text: string): BlankPart[] {
  const parts: BlankPart[] = [];
  let last = 0;
  let index = 0;
  for (const m of text.matchAll(BLANK_RE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: "text", value: text.slice(last, at) });
    parts.push({
      kind: "blank",
      index: index++,
      answers: m[1]
        .split("|")
        .map((a) => a.trim())
        .filter(Boolean),
    });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

export function blankAnswers(step: BlankStep): string[][] {
  return parseBlankText(step.text).flatMap((p) => (p.kind === "blank" ? [p.answers] : []));
}

/**
 * Typed answers forgive case, surrounding space, runs of space, curly quotes
 * and trailing punctuation. Nothing fuzzier: a typo is a wrong answer, the way
 * it is on a test.
 */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/, "")
    .trim();
}

// ---- shuffling --------------------------------------------------------------

/** Deterministic per seed, so a re-render never reshuffles under the learner. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // A shuffle that lands in the answer order gives the answer away; rotate it.
  if (out.length > 1 && out.every((v, i) => v === items[i])) out.push(out.shift() as T);
  return out;
}

// ---- grading ----------------------------------------------------------------

export function gradeChoice(step: ChoiceStep, picked: number[]): boolean {
  const right = step.choices.flatMap((c, i) => (c.correct ? [i] : []));
  return right.length === picked.length && right.every((i) => picked.includes(i));
}

export function gradeBlank(step: BlankStep, filled: string[]): boolean[] {
  return blankAnswers(step).map((answers, i) => {
    const got = normalizeAnswer(filled[i] ?? "");
    if (!got) return false;
    // Word-bank mode only offers the first answer as a tile.
    const accepted = step.bank ? answers.slice(0, 1) : answers;
    return accepted.some((a) => normalizeAnswer(a) === got);
  });
}

export function gradeOrder(step: OrderStep, order: string[]): boolean {
  return order.length === step.items.length && order.every((v, i) => v === step.items[i]);
}

// ---- local progress for signed-out learners ---------------------------------

const LOCAL_KEY = (courseId: string) => `shane:course-progress:${courseId}`;

export function readLocalProgress(courseId: string): CourseProgress[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(courseId));
    const parsed = raw ? (JSON.parse(raw) as CourseProgress[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalProgress(courseId: string, lessonId: string, score: number): CourseProgress {
  const now = new Date().toISOString();
  const all = readLocalProgress(courseId);
  const prev = all.find((p) => p.lessonId === lessonId);
  const next: CourseProgress = prev
    ? {
        ...prev,
        bestScore: Math.max(prev.bestScore, score),
        lastScore: score,
        attempts: prev.attempts + 1,
        updatedAt: now,
      }
    : { lessonId, bestScore: score, lastScore: score, attempts: 1, completedAt: now, updatedAt: now };
  const rest = all.filter((p) => p.lessonId !== lessonId);
  try {
    localStorage.setItem(LOCAL_KEY(courseId), JSON.stringify([...rest, next]));
  } catch {
    /* storage full or blocked: progress just is not remembered */
  }
  return next;
}

export function clearLocalProgress(courseId: string): void {
  try {
    localStorage.removeItem(LOCAL_KEY(courseId));
  } catch {
    /* ignore */
  }
}

// ---- a lesson left halfway (SHAN-659) -----------------------------------------

/**
 * Where a learner stopped inside a lesson, so it can be picked up again. One
 * per course, on this device: opening another lesson and answering a card
 * replaces it, finishing the lesson clears it. `queue` holds step indexes and
 * includes the missed ones re-queued at the end, so a resumed run brings them
 * back too.
 */
export interface LessonRun {
  queue: number[];
  pos: number;
  firstTry: Record<number, boolean>;
  requeued: number[];
  resolved: number;
  streak: number;
  elapsedMs: number;
}

export interface SavedLessonRun {
  lessonId: string;
  /** Changes when the lesson's steps are edited; a run for old steps is dropped. */
  fingerprint: string;
  savedAt: string;
  run: LessonRun;
}

const RUN_KEY = (courseId: string) => `shane:course-run:${courseId}`;

export function lessonFingerprint(lesson: CourseLesson): string {
  const s = JSON.stringify(lesson.steps);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${lesson.steps.length}:${(h >>> 0).toString(36)}`;
}

/** The saved run if it still fits the lesson as it is now, else null (and it is dropped). */
export function readLessonRun(courseId: string, lessons: Map<string, CourseLesson>): SavedLessonRun | null {
  try {
    const raw = localStorage.getItem(RUN_KEY(courseId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedLessonRun;
    const lesson = lessons.get(saved?.lessonId);
    const r = saved?.run;
    const fits =
      lesson &&
      saved.fingerprint === lessonFingerprint(lesson) &&
      Array.isArray(r?.queue) &&
      r.queue.every((i) => Number.isInteger(i) && i >= 0 && i < lesson.steps.length) &&
      Number.isInteger(r.pos) &&
      r.pos > 0 &&
      r.pos < r.queue.length;
    if (fits) return saved;
    localStorage.removeItem(RUN_KEY(courseId));
  } catch {
    /* unreadable: treat as no run */
  }
  return null;
}

export function writeLessonRun(courseId: string, lesson: CourseLesson, run: LessonRun): SavedLessonRun {
  const saved: SavedLessonRun = {
    lessonId: lesson.id,
    fingerprint: lessonFingerprint(lesson),
    savedAt: new Date().toISOString(),
    run,
  };
  try {
    localStorage.setItem(RUN_KEY(courseId), JSON.stringify(saved));
  } catch {
    /* storage full or blocked: the place just is not remembered */
  }
  return saved;
}

export function clearLessonRun(courseId: string): void {
  try {
    localStorage.removeItem(RUN_KEY(courseId));
  } catch {
    /* ignore */
  }
}
