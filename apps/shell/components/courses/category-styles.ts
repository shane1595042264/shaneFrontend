// components/courses/category-styles.ts
// Category tint map for the Courses element. Tailwind cannot build dynamic
// class names, so every category maps to literal classes (same rule as
// components/scoreboard/palette.ts). gradFrom/gradTo are hex pairs for the
// GeneratedCover SVG gradient. Keep the key list in sync with
// COURSE_CATEGORIES in shaneBackend/src/modules/courses/repo.ts.
export interface CategoryStyle {
  text: string;
  bg: string;
  border: string;
  gradFrom: string;
  gradTo: string;
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  math:               { text: "text-sky-400",     bg: "bg-sky-950/40",     border: "border-sky-500",     gradFrom: "#0c4a6e", gradTo: "#38bdf8" },
  physics:            { text: "text-violet-400",  bg: "bg-violet-950/40",  border: "border-violet-500",  gradFrom: "#2e1065", gradTo: "#a78bfa" },
  "computer-science": { text: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-500", gradFrom: "#064e3b", gradTo: "#34d399" },
  engineering:        { text: "text-amber-400",   bg: "bg-amber-950/40",   border: "border-amber-500",   gradFrom: "#78350f", gradTo: "#fbbf24" },
  biology:            { text: "text-lime-400",    bg: "bg-lime-950/40",    border: "border-lime-500",    gradFrom: "#365314", gradTo: "#a3e635" },
  chemistry:          { text: "text-teal-400",    bg: "bg-teal-950/40",    border: "border-teal-500",    gradFrom: "#134e4a", gradTo: "#2dd4bf" },
  history:            { text: "text-orange-400",  bg: "bg-orange-950/40",  border: "border-orange-500",  gradFrom: "#7c2d12", gradTo: "#fb923c" },
  economics:          { text: "text-yellow-400",  bg: "bg-yellow-950/40",  border: "border-yellow-500",  gradFrom: "#713f12", gradTo: "#facc15" },
  philosophy:         { text: "text-purple-400",  bg: "bg-purple-950/40",  border: "border-purple-500",  gradFrom: "#3b0764", gradTo: "#c084fc" },
  language:           { text: "text-rose-400",    bg: "bg-rose-950/40",    border: "border-rose-500",    gradFrom: "#881337", gradTo: "#fb7185" },
  art:                { text: "text-pink-400",    bg: "bg-pink-950/40",    border: "border-pink-500",    gradFrom: "#831843", gradTo: "#f472b6" },
  music:              { text: "text-fuchsia-400", bg: "bg-fuchsia-950/40", border: "border-fuchsia-500", gradFrom: "#701a75", gradTo: "#e879f9" },
  other:              { text: "text-gray-400",    bg: "bg-gray-900/60",    border: "border-gray-600",    gradFrom: "#1f2937", gradTo: "#9ca3af" },
};

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other;
}

export const DIFFICULTY_STYLES: Record<string, string> = {
  intro:        "border-emerald-500 bg-emerald-950/40 text-emerald-400",
  intermediate: "border-amber-500 bg-amber-950/40 text-amber-400",
  advanced:     "border-rose-500 bg-rose-950/40 text-rose-400",
};
