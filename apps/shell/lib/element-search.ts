import type { ElementConfig } from "@shane/types";

/**
 * Ranked, case-insensitive search across the element registry.
 *
 * Kept as a pure function (no React) so the periodic table and the search
 * combobox can derive the same result list from the same query without one
 * pushing state into the other.
 *
 * Rank order — lower is better:
 *   0 exact symbol      ("jr" -> Jr)
 *   1 exact name
 *   2 name prefix       ("jou" -> Journal)
 *   3 symbol prefix
 *   4 name substring    ("owes" -> Who Owes Me)
 *   5 category prefix   ("game" -> every gaming element)
 *   6 description or category substring
 * Ties break alphabetically by name so the list order is stable.
 */
export function searchElements(
  elements: ElementConfig[],
  query: string
): ElementConfig[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: { element: ElementConfig; score: number }[] = [];

  for (const element of elements) {
    const symbol = element.symbol.toLowerCase();
    const name = element.name.toLowerCase();
    const description = (element.description || "").toLowerCase();
    const category = (element.category || "").toLowerCase();

    let score = -1;
    if (symbol === q) score = 0;
    else if (name === q) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (symbol.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 4;
    else if (category.startsWith(q)) score = 5;
    else if (category.includes(q) || description.includes(q)) score = 6;

    if (score >= 0) scored.push({ element, score });
  }

  scored.sort(
    (a, b) => a.score - b.score || a.element.name.localeCompare(b.element.name)
  );

  return scored.map((s) => s.element);
}
