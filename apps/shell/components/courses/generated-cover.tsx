"use client";

import { categoryStyle } from "./category-styles";

// Deterministic cover art for courses with no uploaded image. Pure CSS/SVG,
// seeded by the slug so every course keeps a stable, unique look. No emoji,
// no network.
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function GeneratedCover({
  title,
  category,
  slug,
  hideTitle = false,
}: {
  title: string;
  category: string;
  slug: string;
  hideTitle?: boolean;
}) {
  const style = categoryStyle(category);
  const seed = hashCode(slug);
  const angle = 15 + (seed % 150);
  // Three decorative circles with seeded positions/sizes.
  const circles = [0, 1, 2].map((i) => {
    const s = hashCode(`${slug}:${i}`);
    return {
      cx: 8 + (s % 84),
      cy: 8 + ((s >> 3) % 84),
      r: 12 + ((s >> 6) % 26),
    };
  });

  return (
    <div
      aria-hidden="true"
      className="relative h-full w-full overflow-hidden"
      style={{
        background: `linear-gradient(${angle}deg, ${style.gradFrom} 0%, ${style.gradTo} 100%)`,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-25"
      >
        {circles.map((c, i) => (
          <circle
            key={i}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />
        ))}
        <path
          d={`M0 ${70 + (seed % 20)} Q 30 ${40 + (seed % 30)}, 60 ${60 + (seed % 20)} T 100 ${50 + (seed % 30)}`}
          fill="none"
          stroke="white"
          strokeWidth="0.8"
          opacity="0.7"
        />
      </svg>
      {!hideTitle && (
        <span className="absolute inset-0 flex items-end p-4">
          <span className="line-clamp-3 text-left text-xl font-bold leading-tight tracking-tight text-white/90 drop-shadow">
            {title}
          </span>
        </span>
      )}
    </div>
  );
}
