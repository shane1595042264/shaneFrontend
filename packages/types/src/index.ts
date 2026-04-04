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

export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  voiceProfileVersion: number;
  generationMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedActivity {
  id: string;
  date: string;
  source: string;
  type: string;
  data: Record<string, unknown>;
}

export interface Correction {
  id: string;
  entryId: string;
  suggestionText: string;
  originalContent: string;
  correctedContent: string;
  extractedFacts: string[];
  createdAt: string;
}

export interface LearnedFact {
  id: string;
  factText: string;
  createdAt: string;
}

export interface SuggestionResponse {
  correctedContent: string;
  extractedFacts: string[];
}

export const CATEGORY_COLORS: Record<ElementConfig["category"], string> = {
  data: "text-element-data border-element-data",
  gaming: "text-element-gaming border-element-gaming",
  creative: "text-element-creative border-element-creative",
  tools: "text-element-tools border-element-tools",
  projects: "text-element-projects border-element-projects",
};
