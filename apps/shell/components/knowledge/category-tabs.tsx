"use client";

const CATEGORY_COLORS: Record<string, string> = {
  vocabulary: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  coding: "bg-green-500/20 border-green-500/40 text-green-400",
  general: "bg-gray-500/20 border-gray-500/40 text-gray-400",
};

function getCategoryStyle(category: string, active: boolean) {
  if (active) {
    return CATEGORY_COLORS[category] || "bg-purple-500/20 border-purple-500/40 text-purple-400";
  }
  return "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/8";
}

interface CategoryTabsProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect("")}
        className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${
          selected === ""
            ? "bg-white/15 border-white/30 text-white"
            : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/8"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`px-3 py-1.5 text-xs border rounded-full transition-colors capitalize ${getCategoryStyle(
            cat,
            selected === cat
          )}`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
