"use client";

import Link from "next/link";

interface Props {
  itemId: string;
  totalStrikes: number;
  loadedLocations: number;
  isSolidified: boolean;
}

export function ProgressChip({ itemId, totalStrikes, loadedLocations, isSolidified }: Props) {
  if (isSolidified) {
    return (
      <Link href={`/practice/items/${itemId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-500/20">
        ✓ Solidified
      </Link>
    );
  }
  if (totalStrikes === 0) return null;
  return (
    <Link href={`/practice/items/${itemId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-300 hover:bg-white/10">
      {totalStrikes} strike{totalStrikes === 1 ? "" : "s"} · {loadedLocations}/7 loaded
    </Link>
  );
}
