export interface ElementConfig {
  id: string;
  symbol: string;
  name: string;
  category: "data" | "data-tracking" | "gaming" | "creative" | "tools" | "projects" | string;
  type: "internal" | "external";
  route?: string;
  url?: string;
  status: "live" | "coming-soon" | "offline";
  description: string;
  authRequired?: boolean;
}


export const CATEGORY_COLORS: Record<ElementConfig["category"], string> = {
  data: "text-element-data border-element-data",
  gaming: "text-element-gaming border-element-gaming",
  creative: "text-element-creative border-element-creative",
  tools: "text-element-tools border-element-tools",
  projects: "text-element-projects border-element-projects",
};
