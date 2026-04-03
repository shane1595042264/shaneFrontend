"use client";

interface FilterBarProps {
  languages: string[];
  labels: string[];
  selectedLanguage: string;
  selectedLabel: string;
  search: string;
  onLanguageChange: (lang: string) => void;
  onLabelChange: (label: string) => void;
  onSearchChange: (search: string) => void;
}

export function FilterBar({
  languages,
  labels,
  selectedLanguage,
  selectedLabel,
  search,
  onLanguageChange,
  onLabelChange,
  onSearchChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        placeholder="Search words..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 w-48"
      />

      <select
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-blue-500/50"
      >
        <option value="">All languages</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>

      <select
        value={selectedLabel}
        onChange={(e) => onLabelChange(e.target.value)}
        className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-blue-500/50"
      >
        <option value="">All labels</option>
        {labels.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
