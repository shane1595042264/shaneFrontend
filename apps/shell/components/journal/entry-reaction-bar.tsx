"use client";

import { ReactionBar } from "./reaction-bar";
import { toggleEntryReaction, type Emoji } from "@/lib/api/reactions";

interface Props {
  date: string;
}

/**
 * Thin client wrapper around ReactionBar for use on the entry detail page.
 * The page itself is a Server Component and can't pass a closure prop to a
 * Client Component, so the onToggle handler is defined here and only the
 * `date` string crosses the RSC boundary.
 */
export function EntryReactionBar({ date }: Props) {
  return (
    <ReactionBar
      onToggle={async (e: Emoji) => {
        await toggleEntryReaction(date, e);
      }}
    />
  );
}
