"use client";

import { useState } from "react";

// Hand-drawn 5-point star path on a 20x20 viewBox. No emoji (house rule).
const STAR_PATH =
  "M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z";

function Star({ fillPct }: { fillPct: number }) {
  return (
    <span className="relative inline-block h-5 w-5">
      <svg viewBox="0 0 20 20" className="absolute inset-0 h-5 w-5 text-white/15">
        <path d={STAR_PATH} fill="currentColor" />
      </svg>
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${fillPct}%` }}
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5 text-amber-400">
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

export function StarRating({
  average,
  count,
  mine,
  canRate,
  busy = false,
  onRate,
  onClear,
  compact = false,
}: {
  average: number | null;
  count: number;
  mine: number | null;
  canRate: boolean;
  busy?: boolean;
  onRate?: (stars: number) => void;
  onClear?: () => void;
  compact?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Hover preview > my rating > public average.
  const shown = hover ?? mine ?? average ?? 0;

  const stars = [1, 2, 3, 4, 5].map((i) => {
    const fillPct = Math.max(0, Math.min(1, shown - (i - 1))) * 100;
    if (!canRate) return <Star key={i} fillPct={fillPct} />;
    return (
      <button
        key={i}
        type="button"
        disabled={busy}
        onMouseEnter={() => setHover(i)}
        onMouseLeave={() => setHover(null)}
        onClick={() => (mine === i ? onClear?.() : onRate?.(i))}
        aria-label={mine === i ? `Clear your ${i}-star rating` : `Rate ${i} stars`}
        className="disabled:opacity-50"
      >
        <Star fillPct={fillPct} />
      </button>
    );
  });

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex"
        role={canRate ? undefined : "img"}
        aria-label={
          average !== null ? `Rated ${average.toFixed(1)} out of 5` : "Not yet rated"
        }
      >
        {stars}
      </span>
      {!compact && (
        <span className="text-xs tabular-nums text-gray-400">
          {average !== null ? average.toFixed(1) : "-"} ({count})
        </span>
      )}
      {canRate && mine !== null && !compact && (
        <span className="text-xs text-amber-400/80">yours: {mine}</span>
      )}
    </span>
  );
}
