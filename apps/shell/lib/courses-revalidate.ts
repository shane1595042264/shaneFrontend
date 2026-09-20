"use server";

import { revalidatePath } from "next/cache";

/**
 * SHAN-504. /courses/[slug] moved from cache:"no-store" to ISR at 300s, so
 * without this a mutation is invisible to other viewers for up to five
 * minutes. Mirrors lib/blog-revalidate.ts and lib/journal-revalidate.ts.
 *
 * Called from components/courses/course-interactive.tsx rather than from
 * lib/api/courses.ts, because the courses API functions are id-based and the
 * slug only exists at the call sites. Blog's API functions already take a
 * slug, which is why its wiring sits one layer lower.
 *
 * SHAN-510: the /courses index is now server-rendered and cached too, so it is
 * busted alongside the detail page. A retitle, a rating and a delete all change
 * what the index card says, and a deleted course would otherwise keep its card
 * in the cached grid until the window expired.
 */
export async function revalidateCourse(slug: string): Promise<void> {
  revalidatePath(`/courses/${slug}`, "page");
  revalidatePath("/courses", "page");
}

/**
 * The index on its own, for a create: the new course has no cached detail page
 * to drop yet, only a grid that does not know about it (SHAN-510).
 */
export async function revalidateCoursesIndex(): Promise<void> {
  revalidatePath("/courses", "page");
}
