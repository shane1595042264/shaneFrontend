"use client";

import { PrevNextKeys } from "@/components/reading/prev-next-keys";

interface EntryKeyboardNavProps {
  prevDate: string | null;
  nextDate: string | null;
}

/** ←/j and →/k between journal entries; the keys themselves live in PrevNextKeys. */
export function EntryKeyboardNav({ prevDate, nextDate }: EntryKeyboardNavProps) {
  return (
    <PrevNextKeys
      prevHref={prevDate ? `/journal/${prevDate}` : null}
      nextHref={nextDate ? `/journal/${nextDate}` : null}
    />
  );
}
