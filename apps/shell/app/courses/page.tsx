import { CoursesCatalog } from "@/components/courses/catalog";
import { API_URL } from "@/lib/api-url";
import type { Course } from "@/lib/api/courses";

// SHAN-510: this page used to be one "use client" component, so the document
// prod served was 20KB of navigation chrome with ClientPageRoot where the
// catalog should have been - not one course title, category or rating. The
// sitemap advertises /courses and robots.txt allows it, and GET /api/courses
// needs no auth (only add/edit/delete are gated), so nothing was being withheld
// on purpose: the public content simply was not in the HTML. Same fix as
// /vocabulary (SHAN-507), /scoreboard (SHAN-508) and /knowledge (SHAN-509).
//
// 300s matches /blog, /courses/[slug] and /vocabulary. Mutations bust the cache
// through lib/courses-revalidate.ts, so the window only affects how stale a
// cold visitor's first paint can be, never how long an author waits.
export const revalidate = 300;

// Mirrors listCourses() in lib/api/courses.ts: the catalog filters and sorts
// client-side so it wants every course, and the endpoint pages at 100. The cap
// just bounds a runaway loop.
const PAGE_SIZE = 100;
const COURSES_MAX = 5000;

/**
 * Deliberately does NOT run listCourses' absolutize() on coverUrl.
 *
 * API_URL is the backend origin on the server and "" in the browser (SHAN-458),
 * so absolutizing here would put an img src of
 * shanebackend-production.up.railway.app/... in the server HTML while the
 * client's own absolutize leaves the same field as /api/... - a hydration
 * mismatch on every card that has a cover. Left relative, both sides render the
 * identical same-origin path, which is the routing this site wants anyway.
 *
 * Fails soft to null rather than throwing: this route is prerendered, so a
 * backend hiccup during a build must not fail the deploy. null puts the browser
 * back on the original fetch-on-mount path (skeleton, then content).
 */
async function fetchCatalog(): Promise<Course[] | null> {
  const out: Course[] = [];
  let cursor: string | null = null;
  try {
    while (out.length < COURSES_MAX) {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`${API_URL}/api/courses?${qs}`, {
        next: { revalidate },
      });
      if (!res.ok) return null;
      const page = (await res.json()) as {
        courses: Course[];
        nextCursor: string | null;
      };
      out.push(...page.courses);
      if (page.courses.length === 0 || !page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } catch {
    return null;
  }
  return out;
}

// Public catalog: no AuthGate. Admin controls render only for a signed-in
// user (scoreboard pattern).
export default async function CoursesPage() {
  return <CoursesCatalog initialCourses={await fetchCatalog()} />;
}
