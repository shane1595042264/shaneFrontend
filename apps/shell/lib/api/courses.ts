import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";
import type { ContentIssue, ContentStats, CourseContent, CourseProgress } from "@/lib/course-lessons";

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
    throw new Error((err as { error?: string }).error || `${res.status}`);
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
    throw new Error((err as { error?: string }).error || `${res.status}`);
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
    throw new Error((err as { error?: string }).error || `Upload failed (${res.status})`);
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
    throw new Error((err as { error?: string }).error || `Validation failed (${res.status})`);
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
  if (!res.ok) throw new Error((data as { error?: string }).error || `Save failed (${res.status})`);
  const out = data as CourseContentResponse & { course: Course };
  return { ...out, course: absolutize(out.course) };
}

export const listCourseProgress = (courseId: string) =>
  api<{ progress: CourseProgress[] }>(`/api/courses/${courseId}/progress`).then((r) => r.progress);

export const recordLessonProgress = (courseId: string, lessonId: string, score: number) =>
  api<{ progress: CourseProgress }>(
    `/api/courses/${courseId}/progress/${encodeURIComponent(lessonId)}`,
    { method: "PUT", body: JSON.stringify({ score }) },
  ).then((r) => r.progress);

export const resetCourseProgress = (courseId: string) =>
  api<void>(`/api/courses/${courseId}/progress`, { method: "DELETE" });
