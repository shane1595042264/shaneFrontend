"use client";

// SHAN-576: one active style for every category, the same quiet pill the site
// nav uses, instead of a different colour per category. The colours encoded
// nothing the label did not already say, and four hues in one row of filters
// was the loudest thing on the page.
function pillClass(active: boolean) {
  return `inline-flex h-8 items-center rounded-full px-3.5 text-[13px] capitalize transition-[background-color,color,transform] active:scale-[0.98] ${
    active
      ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/15"
      : "text-gray-400 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.04] hover:text-white"
  }`;
}

interface CategoryTabsProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
      <button
        type="button"
        aria-pressed={selected === ""}
        onClick={() => onSelect("")}
        className={pillClass(selected === "")}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          aria-pressed={selected === cat}
          onClick={() => onSelect(cat)}
          className={pillClass(selected === cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
