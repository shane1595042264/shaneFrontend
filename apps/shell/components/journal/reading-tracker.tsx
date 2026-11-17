"use client";

import type { RefObject } from "react";
import { useAuth } from "@/lib/auth-context";
import { getReadingPosition, saveReadingPosition } from "@/lib/api/journal-reading";
import { ReadingTracker as Tracker, type ReadingRemote } from "@/components/reading/reading-tracker";

interface Props {
  date: string;
  /** The article holding the entry and its appends: what a position is measured against. */
  articleRef: RefObject<HTMLElement | null>;
}

/**
 * SHAN-597: the journal's reading tracker. Members only, so there is always a
 * signed-in reader and a server copy to sync with. The tracker itself is
 * shared with the blog since SHAN-705 (components/reading/reading-tracker.tsx).
 */
export function ReadingTracker({ date, articleRef }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const remote: ReadingRemote = {
    get: () => getReadingPosition(date),
    save: (pos, opts) => saveReadingPosition(date, pos, opts),
  };
  return (
    <Tracker
      id={userId ? date : null}
      // Unchanged from SHAN-597, so copies saved before the move still restore.
      localKey={`shane:journal-reading:${userId}:${date}`}
      remote={remote}
      noun="entry"
      articleRef={articleRef}
    />
  );
}
