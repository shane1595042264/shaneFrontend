"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "@/components/transition-link";
import type { ReadingPosition } from "@/lib/api/journal-reading";
import { formatRelativeTime } from "@/lib/format-time";
import { READ_THROUGH, readingSnippet } from "@/lib/reading-position";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

function longDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function shortDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Thin progress line; only its transform moves, and only on the way in. */
function Bar({ progress, reduce, className }: { progress: number; reduce: boolean; className: string }) {
  return (
    <span aria-hidden="true" className={`block overflow-hidden rounded-full bg-white/10 ${className}`}>
      <motion.span
        className="block h-full origin-left rounded-full bg-blue-400"
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: progress }}
        transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.1 }}
      />
    </span>
  );
}

interface Props {
  /** The reader's positions, most recently read first. */
  positions: ReadingPosition[];
}

/**
 * SHAN-597: the top of /journal, for a signed-in member who is partway through
 * something. The card is the entry they read last that they have not finished;
 * opening it lands on their spot, because the entry page restores it. Up to two
 * other unfinished entries ride along underneath.
 *
 * Renders nothing until the positions arrive and nothing when there is nothing
 * to resume, so it never holds space open on the page.
 */
export function ContinueReading({ positions }: Props) {
  const reduce = useReducedMotion() ?? false;
  const unfinished = positions.filter((p) => p.progress < READ_THROUGH);
  const [primary, ...rest] = unfinished;
  if (!primary) return null;
  const others = rest.slice(0, 2);
  const pct = Math.round(primary.progress * 100);

  return (
    <motion.section
      aria-label="Continue reading"
      // A rise, never a fade: this sits above the fold (SHAN-549).
      initial={reduce ? false : { y: 10 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      className="mb-8"
    >
      <Link
        href={`/journal/${primary.date}`}
        className="spot group block rounded-xl border border-white/10 bg-white/[0.025] p-5 transition-[border-color,scale] hover:border-white/20 active:scale-[0.995]"
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-blue-400">
            Continue reading
          </span>
          <span className="font-mono text-[11px] tabular-nums text-gray-400">
            {formatRelativeTime(primary.updatedAt)}
          </span>
        </span>
        <span className="mt-2 block text-lg font-semibold tracking-tight text-white">
          {longDate(primary.date)}
        </span>
        {primary.anchor.text && (
          <span className="mt-1.5 block line-clamp-2 text-sm leading-relaxed text-gray-300">
            &ldquo;{readingSnippet(primary.anchor.text)}&rdquo;
          </span>
        )}
        <span className="mt-4 flex items-center gap-3">
          <Bar progress={primary.progress} reduce={reduce} className="h-1 flex-1" />
          <span className="font-mono text-xs tabular-nums text-gray-300">
            {pct}%<span className="sr-only"> read</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-white">
            Resume
            <span
              aria-hidden="true"
              className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5"
            >
              &rarr;
            </span>
          </span>
        </span>
      </Link>

      {others.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span>Also partway through</span>
          {others.map((p) => (
            <Link
              key={p.date}
              href={`/journal/${p.date}`}
              className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 px-3 text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              {shortDate(p.date)}
              <Bar progress={p.progress} reduce={reduce} className="h-[3px] w-8" />
              <span className="font-mono tabular-nums">
                {Math.round(p.progress * 100)}%<span className="sr-only"> read</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </motion.section>
  );
}
