import type { GameIconData } from "@/lib/api/scoreboard";

/**
 * Renders a game's stored icon path data as a plain inline SVG. The path is
 * text extracted server-side from a game-icons.net icon; no third-party
 * markup ever reaches the DOM. Tint via text color on a parent (currentColor).
 */
export function GameIcon({
  icon,
  className,
}: {
  icon: GameIconData;
  className?: string;
}) {
  return (
    <svg
      viewBox={icon.viewBox}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={icon.path} fill="currentColor" />
    </svg>
  );
}

/** Hand-drawn crown for winners (house pattern: local SVG, no icon dep). */
export function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1.5 5.5 4.5 8.5 8 3.5 11.5 8.5 14.5 5.5 13.2 12.5 H2.8 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
