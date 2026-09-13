"use client";

import { ReactionDisplay } from "@/components/journal/reaction-display";
import type { Emoji } from "@/lib/api/reactions";
import { getBlogPostReactions, toggleBlogPostReaction } from "@/lib/api/blog-social";

/**
 * SHAN-488. The reaction bar on a public post.
 *
 * Thin client wrapper for the same reason EntryReactionBar is one: the page is
 * an ISR Server Component and cannot hand a closure across the RSC boundary, so
 * only the `slug` string crosses it and the handlers are built here.
 *
 * It imports ReactionDisplay out of components/journal/ rather than copying it:
 * that component takes its data through `refetch`/`onToggle` props and knows
 * nothing about the journal beyond living in its folder. Only the URLs in
 * lib/api/reactions.ts are journal-specific, and those are not used here.
 *
 * ReactionDisplay already renders counts for everyone and disables the chips
 * when useAuth().user is null, which is exactly the signed-out behaviour this
 * page wants — a reader sees what the post earned and is told to sign in to
 * add to it.
 */
export function PostReactionBar({ slug }: { slug: string }) {
  return (
    <ReactionDisplay
      refetch={() => getBlogPostReactions(slug)}
      onToggle={(e: Emoji) => toggleBlogPostReaction(slug, e)}
    />
  );
}
