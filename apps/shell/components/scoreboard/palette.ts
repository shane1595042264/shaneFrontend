// Palette tokens shared with the backend (SCOREBOARD_COLORS in
// shaneBackend/src/modules/scoreboard/repo.ts). Keep both lists in sync.
// Tailwind cannot build dynamic class names, so every token maps to
// literal classes here.
export interface ColorStyle {
  text: string;
  bg: string;
  border: string;
  solid: string;
  ring: string;
}

export const COLOR_STYLES: Record<string, ColorStyle> = {
  amber:   { text: "text-amber-400",   bg: "bg-amber-950/40",   border: "border-amber-500",   solid: "bg-amber-400",   ring: "ring-amber-400" },
  sky:     { text: "text-sky-400",     bg: "bg-sky-950/40",     border: "border-sky-500",     solid: "bg-sky-400",     ring: "ring-sky-400" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-500", solid: "bg-emerald-400", ring: "ring-emerald-400" },
  fuchsia: { text: "text-fuchsia-400", bg: "bg-fuchsia-950/40", border: "border-fuchsia-500", solid: "bg-fuchsia-400", ring: "ring-fuchsia-400" },
  rose:    { text: "text-rose-400",    bg: "bg-rose-950/40",    border: "border-rose-500",    solid: "bg-rose-400",    ring: "ring-rose-400" },
  violet:  { text: "text-violet-400",  bg: "bg-violet-950/40",  border: "border-violet-500",  solid: "bg-violet-400",  ring: "ring-violet-400" },
  lime:    { text: "text-lime-400",    bg: "bg-lime-950/40",    border: "border-lime-500",    solid: "bg-lime-400",    ring: "ring-lime-400" },
  cyan:    { text: "text-cyan-400",    bg: "bg-cyan-950/40",    border: "border-cyan-500",    solid: "bg-cyan-400",    ring: "ring-cyan-400" },
  orange:  { text: "text-orange-400",  bg: "bg-orange-950/40",  border: "border-orange-500",  solid: "bg-orange-400",  ring: "ring-orange-400" },
  teal:    { text: "text-teal-400",    bg: "bg-teal-950/40",    border: "border-teal-500",    solid: "bg-teal-400",    ring: "ring-teal-400" },
};

export const COLOR_TOKENS = Object.keys(COLOR_STYLES);

export function colorStyles(token: string): ColorStyle {
  return COLOR_STYLES[token] ?? COLOR_STYLES.emerald;
}
