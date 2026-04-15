import type { ElementConfig } from "@shane/types";

export const CATEGORY_STYLES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  "data-tracking": {
    bg: "bg-blue-950/40",
    border: "border-blue-500",
    text: "text-blue-400",
  },
  data: {
    bg: "bg-blue-950/40",
    border: "border-blue-500",
    text: "text-blue-400",
  },
  gaming: {
    bg: "bg-green-950/40",
    border: "border-green-500",
    text: "text-green-400",
  },
  creative: {
    bg: "bg-purple-950/40",
    border: "border-purple-500",
    text: "text-purple-400",
  },
  tools: {
    bg: "bg-orange-950/40",
    border: "border-orange-500",
    text: "text-orange-400",
  },
  projects: {
    bg: "bg-teal-950/40",
    border: "border-teal-500",
    text: "text-teal-400",
  },
};

export function getDefaultElements(): ElementConfig[] {
  return [
    {
      id: "journal",
      symbol: "Jn",
      name: "Journal",
      category: "data",
      type: "internal",
      route: "/journal",
      status: "live",
      description: "Data tracking and personal journaling",
    },
    {
      id: "hardcore",
      symbol: "Hc",
      name: "Hardcore",
      category: "gaming",
      type: "internal",
      status: "coming-soon",
      description: "Gaming hub and hardcore challenges",
    },
    {
      id: "inventory",
      symbol: "In",
      name: "Inventory",
      category: "tools",
      type: "internal",
      status: "coming-soon",
      description: "Tools and inventory management",
    },
    {
      id: "github",
      symbol: "Gh",
      name: "GitHub",
      category: "projects",
      type: "external",
      url: "https://github.com/shane1595042264",
      status: "live",
      description: "Open source projects and code",
    },
    {
      id: "youtube",
      symbol: "Yt",
      name: "YouTube",
      category: "creative",
      type: "external",
      status: "coming-soon",
      description: "Creative video content",
    },
    {
      id: "bilibili",
      symbol: "Bl",
      name: "Bilibili",
      category: "creative",
      type: "external",
      status: "coming-soon",
      description: "Creative content on Bilibili",
    },
  ];
}

export async function fetchElements(): Promise<ElementConfig[]> {
  const { allElements } = await import("./element-registry");

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const res = await fetch(`${apiUrl}/api/elements`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    const dbElements = ((data.elements ?? data) as ElementConfig[]).map(
      (el) => ({ ...el, id: String(el.id) })
    );

    // Merge: local manifests are the base, DB elements override by symbol
    const merged = new Map<string, ElementConfig>();
    for (const el of allElements) merged.set(el.symbol, el);
    for (const el of dbElements) merged.set(el.symbol, el);
    return Array.from(merged.values());
  } catch {
    // API unavailable — use local manifests only
    return allElements;
  }
}
