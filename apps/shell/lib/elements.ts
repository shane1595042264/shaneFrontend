/**
 * Periodic-table category colors.
 *
 * SHAN-558: a desaturated set for the site-wide redesign, so the table reads
 * as one quiet surface with a hue per category instead of five loud ones.
 * Creative moved off purple to a dusty rose (the "AI purple" was the loudest
 * thing on the old table). Every `text` value is well above 7:1 on the page
 * background.
 *
 * `line` is the thin category stroke along the top of a tile; `glow` is the
 * tinted hover shadow. Both are literal class strings so Tailwind's scanner
 * picks them up.
 */
export const CATEGORY_STYLES: Record<
  string,
  { bg: string; border: string; text: string; line: string; glow: string }
> = {
  "data-tracking": {
    bg: "bg-[#8fb4ea]/[0.05]",
    border: "border-[#8fb4ea]/25",
    text: "text-[#a9c6f0]",
    line: "via-[#8fb4ea]/70",
    glow: "hover:shadow-[0_8px_28px_-10px_rgb(143_180_234/0.55)]",
  },
  data: {
    bg: "bg-[#8fb4ea]/[0.05]",
    border: "border-[#8fb4ea]/25",
    text: "text-[#a9c6f0]",
    line: "via-[#8fb4ea]/70",
    glow: "hover:shadow-[0_8px_28px_-10px_rgb(143_180_234/0.55)]",
  },
  gaming: {
    bg: "bg-[#8fd4a8]/[0.05]",
    border: "border-[#8fd4a8]/25",
    text: "text-[#a6e0bb]",
    line: "via-[#8fd4a8]/70",
    glow: "hover:shadow-[0_8px_28px_-10px_rgb(143_212_168/0.55)]",
  },
  creative: {
    bg: "bg-[#e0a3c0]/[0.05]",
    border: "border-[#e0a3c0]/25",
    text: "text-[#ebbbd2]",
    line: "via-[#e0a3c0]/70",
    glow: "hover:shadow-[0_8px_28px_-10px_rgb(224_163_192/0.55)]",
  },
  tools: {
    bg: "bg-[#e6b673]/[0.05]",
    border: "border-[#e6b673]/25",
    text: "text-[#efc890]",
    line: "via-[#e6b673]/70",
    glow: "hover:shadow-[0_8px_28px_-10px_rgb(230_182_115/0.55)]",
  },
  projects: {
    bg: "bg-[#5eead4]/[0.05]",
    border: "border-[#5eead4]/25",
    text: "text-[#7ff0dd]",
    line: "via-[#5eead4]/70",
    glow: "hover:shadow-[0_8px_28px_-10px_rgb(94_234_212/0.55)]",
  },
};
