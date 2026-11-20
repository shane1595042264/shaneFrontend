import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";
import type {
  ContentIssue,
  ContentStats,
  CourseContent,
  CourseProgress,
  CourseStep,
  ExamResult,
  ReciteVerdict,
} from "@/lib/course-lessons";

export type CourseDifficulty = "intro" | "intermediate" | "advanced";

/** SHAN-617: a private course is visible only to its creator and the site owner. */
export type CourseVisibility = "public" | "private";

export interface CourseRatingSummary {
  average: number | null;
  count: number;
}

export interface Course {
  id: string;
  slug: string;
  /** The slide deck it launches. Null for a course that is only lessons. */
  url: string | null;
  title: string;
  description: string | null;
  category: string;
  difficulty: CourseDifficulty;
  durationMinutes: number | null;
  tags: string[];
  visibility: CourseVisibility;
  /** SHAN-720: finishing every lesson earns a certificate. */
  certified: boolean;
  ownerId: string;
  coverUrl: string | null;
  rating: CourseRatingSummary;
  commentCount: number;
  myStars: number | null;
  /** SHAN-652: interactive lessons played on this site. 0 = deck only. */
  lessonCount: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseCommentAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface CourseComment {
  id: string;
  courseId: string;
  parentCommentId: string | null;
  authorId: string;
  author: CourseCommentAuthor | null;
  content: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRatingState extends CourseRatingSummary {
  mine: number | null;
}

/**
 * Where a course is read. A private course cannot live at /courses/<slug>: the
 * middleware probes that path anonymously and the backend 404s a private course
 * to anyone without a token, so it reads at /courses/private/<slug> instead, the
 * same move as the blog's /blog/preview/<slug> drafts (SHAN-487).
 */
export function coursePath(course: Pick<Course, "slug" | "visibility">): string {
  return course.visibility === "private"
    ? `/courses/private/${course.slug}`
    : `/courses/${course.slug}`;
}

/** Backend returns coverUrl relative to the API host; make it absolute. */
function absolutize(c: Course): Course {
  return c.coverUrl && c.coverUrl.startsWith("/")
    ? { ...c, coverUrl: `${API_URL}${c.coverUrl}` }
    : c;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // No `{ error }` body (a gateway 502 serves HTML) leaves the message empty,
    // so the caller's humanizeActionError fallback shows instead of a bare "502".
    throw new Error((err as { error?: string }).error ?? "");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const COURSES_PAGE_SIZE = 100;
const COURSES_MAX = 5000;

/**
 * The catalog filters and sorts client-side, so it needs every course. The
 * endpoint pages at 100, so drain it via nextCursor. The cap mirrors the
 * journal drain in app/journal/page.tsx and just bounds a runaway loop.
 */
export async function listCourses(): Promise<Course[]> {
  const out: Course[] = [];
  let cursor: string | null = null;
  while (out.length < COURSES_MAX) {
    const qs = new URLSearchParams({ limit: String(COURSES_PAGE_SIZE) });
    if (cursor) qs.set("cursor", cursor);
    const page: { courses: Course[]; nextCursor: string | null } = await api<{
      courses: Course[];
      nextCursor: string | null;
    }>(`/api/courses?${qs}`);
    out.push(...page.courses.map(absolutize));
    if (page.courses.length === 0 || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

export const getCourse = (slug: string) =>
  api<{ course: Course }>(`/api/courses/${encodeURIComponent(slug)}`).then((r) =>
    absolutize(r.course),
  );

/**
 * Like getCourse, but resolves to null on a 404. The backend answers a private
 * course that is not yours with the same 404 as a missing one, so the two are
 * deliberately indistinguishable here.
 */
export async function findCourse(slug: string): Promise<Course | null> {
  const res = await fetch(`${API_URL}/api/courses/${encodeURIComponent(slug)}`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "");
  }
  const data = (await res.json()) as { course: Course };
  return absolutize(data.course);
}

export const createCourse = (input: {
  url?: string;
  title?: string;
  visibility?: CourseVisibility;
  description?: string | null;
  category?: string;
  difficulty?: CourseDifficulty;
  tags?: string[];
  content?: unknown;
}) =>
  api<{ course: Course }>("/api/courses", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => absolutize(r.course));

export const updateCourse = (
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    category: string;
    difficulty: CourseDifficulty;
    durationMinutes: number | null;
    tags: string[];
    url: string | null;
    visibility: CourseVisibility;
  }>,
) =>
  api<{ course: Course }>(`/api/courses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => absolutize(r.course));

export const reclassifyCourse = (id: string) =>
  api<{ course: Course }>(`/api/courses/${id}/reclassify`, { method: "POST" }).then(
    (r) => absolutize(r.course),
  );

export const deleteCourse = (id: string) =>
  api<void>(`/api/courses/${id}`, { method: "DELETE" });

/** Multipart upload; do NOT set Content-Type (the browser adds the boundary). */
export async function uploadCourseCover(id: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${API_URL}/api/courses/${id}/cover`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "");
  }
  const data = (await res.json()) as { coverUrl: string };
  return data.coverUrl.startsWith("/") ? `${API_URL}${data.coverUrl}` : data.coverUrl;
}

export const removeCourseCover = (id: string) =>
  api<void>(`/api/courses/${id}/cover`, { method: "DELETE" });

export const rateCourse = (id: string, stars: number) =>
  api<{ rating: CourseRatingState }>(`/api/courses/${id}/rating`, {
    method: "PUT",
    body: JSON.stringify({ stars }),
  }).then((r) => r.rating);

export const clearCourseRating = (id: string) =>
  api<{ rating: CourseRatingState }>(`/api/courses/${id}/rating`, {
    method: "DELETE",
  }).then((r) => r.rating);

export const listCourseComments = (courseId: string) =>
  api<{ comments: CourseComment[] }>(`/api/courses/${courseId}/comments`).then(
    (r) => r.comments,
  );

export const postCourseComment = (
  courseId: string,
  content: string,
  parentCommentId?: string,
) =>
  api<{ comment: CourseComment }>(`/api/courses/${courseId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, parent_comment_id: parentCommentId }),
  }).then((r) => r.comment);

export const editCourseComment = (id: string, content: string) =>
  api<{ comment: CourseComment }>(`/api/courses/comments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  }).then((r) => r.comment);

export const deleteCourseComment = (id: string) =>
  api<void>(`/api/courses/comments/${id}`, { method: "DELETE" });

// ---- SHAN-652: interactive lessons -----------------------------------------

export interface CourseContentResponse {
  content: CourseContent;
  stats: ContentStats;
  updatedAt: string;
}

/** Null when the course has no lessons (or is private to someone else). */
export async function getCourseContent(courseId: string): Promise<CourseContentResponse | null> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}/content`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load lessons (${res.status})`);
  return res.json();
}

export type ValidationResponse =
  | { ok: true; content: CourseContent; stats: ContentStats }
  | { ok: false; issues: ContentIssue[] };

/** Dry run: the server's own validator, so the editor and the API agree. */
export async function validateContent(body: string): Promise<ValidationResponse> {
  const res = await fetch(`${API_URL}/api/courses/content/validate`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "");
  }
  return res.json();
}

export class ContentInvalidError extends Error {
  constructor(public issues: ContentIssue[]) {
    super("Course content is invalid");
  }
}

export async function saveCourseContent(
  courseId: string,
  body: string,
): Promise<CourseContentResponse & { course: Course }> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}/content`, {
    method: "PUT",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 400 && Array.isArray((data as { issues?: unknown }).issues)) {
    throw new ContentInvalidError((data as { issues: ContentIssue[] }).issues);
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "");
  const out = data as CourseContentResponse & { course: Course };
  return { ...out, course: absolutize(out.course) };
}

/** Practice progress, plus (SHAN-721) the learner's exam results. */
export const listCourseProgress = (courseId: string) =>
  api<{ progress: CourseProgress[]; exams?: ExamResult[] }>(`/api/courses/${courseId}/progress`).then((r) => ({
    progress: r.progress,
    exams: r.exams ?? [],
  }));

export const recordLessonProgress = (courseId: string, lessonId: string, score: number) =>
  api<{ progress: CourseProgress }>(
    `/api/courses/${courseId}/progress/${encodeURIComponent(lessonId)}`,
    { method: "PUT", body: JSON.stringify({ score }) },
  ).then((r) => r.progress);

export const resetCourseProgress = (courseId: string) =>
  api<void>(`/api/courses/${courseId}/progress`, { method: "DELETE" });

// ---- SHAN-721: recite steps and exams -------------------------------------

/** Grade one recital in a practice lesson. Signed in only. */
export const reciteCourseStep = (
  courseId: string,
  lessonId: string,
  step: number,
  answer: string,
  attempt: number,
) =>
  api<ReciteVerdict>(
    `/api/courses/${courseId}/lessons/${encodeURIComponent(lessonId)}/steps/${step}/recite`,
    { method: "POST", body: JSON.stringify({ answer, attempt }) },
  );

export interface ExamSubmission {
  score: number;
  right: number;
  graded: number;
  passMark: number;
  passed: boolean;
  /** One per graded step. Says whether it was right, never what was. */
  steps: { index: number; correct: boolean; feedback?: string }[];
  result: ExamResult;
}

/** `answers[i]` answers step i: choice indexes, blank strings, the order, or a recital. */
export const submitExam = (courseId: string, lessonId: string, answers: unknown[]) =>
  api<ExamSubmission>(`/api/courses/${courseId}/exams/${encodeURIComponent(lessonId)}`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });

// ---- SHAN-720: certificates ------------------------------------------------

export interface CourseCertificate {
  /** 12 characters, shown grouped in fours. The public verification id. */
  code: string;
  url: string;
  recipientName: string;
  courseId: string;
  courseSlug: string;
  /** The course title when the certificate was issued. */
  courseTitle: string;
  /** Mean best first-try score across the lessons, 0-100. */
  score: number;
  lessonCount: number;
  issuedAt: string;
}

/** "7K3M9QX2ABCD" -> "7K3M-9QX2-ABCD", the way it is printed. */
export function formatCertificateCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

export function certificatePath(code: string): string {
  return `/courses/certificates/${formatCertificateCode(code)}`;
}

/** Null until this learner has claimed one. */
export async function getMyCertificate(courseId: string): Promise<CourseCertificate | null> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}/certificate`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load your certificate (${res.status})`);
  return ((await res.json()) as { certificate: CourseCertificate }).certificate;
}

export const claimCertificate = (courseId: string, name?: string) =>
  api<{ certificate: CourseCertificate }>(`/api/courses/${courseId}/certificate`, {
    method: "POST",
    body: JSON.stringify(name ? { name } : {}),
  }).then((r) => r.certificate);

// ---- SHAN-722: the recall check --------------------------------------------

export interface RecallResult {
  bestScore: number;
  lastScore: number;
  attempts: number;
  passedAt: string | null;
  updatedAt: string;
}

export interface RecallCheck {
  /**
   * "lessons" until every lesson is done and every exam passed, "waiting" for
   * a day after the last lesson (or a failed sitting), then "open", "passed".
   */
  status: "lessons" | "waiting" | "open" | "passed";
  passMark: number;
  questions: number;
  lessonsLeft: number;
  /** When it opens; null before the lessons are done and once passed. */
  unlocksAt: string | null;
  result: RecallResult | null;
  /** The cards, answers stripped, only while open. */
  draw: { id: string; steps: CourseStep[] } | null;
}

/** On a certified course only; signed in. */
export const getRecallCheck = (courseId: string) =>
  api<{ recall: RecallCheck }>(`/api/courses/${courseId}/recall`).then((r) => r.recall);

export interface RecallSubmission extends Omit<ExamSubmission, "result"> {
  result: RecallResult;
  /** When the next sitting opens, after a failed one. */
  unlocksAt: string | null;
}

/** `answers[i]` answers `draw.steps[i]`; `draw` is the draw's id. */
export const submitRecall = (courseId: string, draw: string, answers: unknown[]) =>
  api<RecallSubmission>(`/api/courses/${courseId}/recall`, {
    method: "POST",
    body: JSON.stringify({ draw, answers }),
  });
