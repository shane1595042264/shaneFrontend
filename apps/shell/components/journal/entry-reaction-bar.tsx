"use client";

import { ReactionDisplay } from "./reaction-display";
import { getEntryReactions, toggleEntryReaction, type Emoji } from "@/lib/api/reactions";

interface Props {
  date: string;
}

/**
 * Thin client wrapper around ReactionDisplay for use on the entry detail page.
 * The page itself is a Server Component and can't pass a closure prop to a
 * Client Component, so the onToggle handler is defined here and only the
 * `date` string crosses the RSC boundary.
 */
export function EntryReactionBar({ date }: Props) {
  return (
    <ReactionDisplay
      refetch={() => getEntryReactions(date)}
      onToggle={(e: Emoji) => toggleEntryReaction(date, e)}
    />
  );
}
