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
 * The /courses index is not revalidated: it is a "use client" page that
 * fetches the catalog in the browser, so it has no server cache to bust.
 */
export async function revalidateCourse(slug: string): Promise<void> {
  revalidatePath(`/courses/${slug}`, "page");
}
