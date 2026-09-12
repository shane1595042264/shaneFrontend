"use server";

import { revalidatePath } from "next/cache";

/**
 * SHAN-487. Both /blog and /blog/[slug] are ISR at 300s, so without this an
 * author's own write is invisible to them for up to five minutes. Every
 * mutation in lib/api/blog.ts calls this, mirroring lib/journal-revalidate.ts.
 *
 * The index is always revalidated, even for an edit: the tile carries the
 * title, excerpt, tags and cover, so a body edit changes the index too.
 */
export async function revalidateBlogPost(slug: string): Promise<void> {
  revalidatePath(`/blog/${slug}`, "page");
  revalidatePath("/blog", "page");
}
