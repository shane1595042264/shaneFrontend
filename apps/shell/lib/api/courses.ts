import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type CourseDifficulty = "intro" | "intermediate" | "advanced";

export interface CourseRatingSummary {
  average: number | null;
  count: number;
}

export interface Course {
  id: string;
  slug: string;
  url: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: CourseDifficulty;
  durationMinutes: number | null;
  tags: string[];
  ownerId: string;
  coverUrl: string | null;
  rating: CourseRatingSummary;
  commentCount: number;
  myStars: number | null;
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

export const createCourse = (input: { url: string; title?: string }) =>
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
    url: string;
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
