import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";

// SHAN-596: bring-your-own-key AI. Every route behind these is browser-session
// only; the key itself never comes back from the server, only its last four.

export type AiProvider = "gemini" | "openai" | "anthropic" | "xai";

export interface AiKey {
  id: string;
  provider: AiProvider;
  keyHint: string;
  /** Text models this key can use, cheapest first. */
  models: string[];
  /** The cheapest model that answered the key check. */
  defaultModel: string;
  preferredModel: string | null;
  status: "ok" | "failing";
  lastError: string | null;
  lastCheckedAt: string;
  createdAt: string;
}

export interface AiSettings {
  preferredProvider: AiProvider | null;
  notesToKnowledge: boolean;
}

export interface Explanation {
  explanation: string;
  provider: AiProvider;
  model: string;
  usage: { inputTokens: number; outputTokens: number; costMicroUsd: number };
}

export interface UsageSummary {
  days: number;
  totals: { calls: number; inputTokens: number; outputTokens: number; costMicroUsd: number };
  byModel: { provider: AiProvider; model: string; calls: number; inputTokens: number; outputTokens: number; costMicroUsd: number }[];
  daily: { day: string; provider: AiProvider; tokens: number; costMicroUsd: number }[];
  recent: {
    id: string;
    provider: AiProvider;
    model: string;
    feature: "explain" | "validate";
    surface: string | null;
    inputTokens: number;
    outputTokens: number;
    costMicroUsd: number | null;
    createdAt: string;
  }[];
}

/** An error carrying the server's `code` (no_key, auth, quota...) for the UI to branch on. */
export class AiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly kind: string | null
  ) {
    super(message);
    this.name = "AiApiError";
  }
}

async function ai<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/ai${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AiApiError(
      typeof body.error === "string" ? body.error : `Request failed (${res.status})`,
      res.status,
      body.code ?? null,
      body.kind ?? null
    );
  }
  return body as T;
}

export const listAiKeys = () =>
  ai<{ keys: AiKey[]; settings: AiSettings; providers: Record<AiProvider, string> }>("/keys");

export const addAiKey = (key: string) =>
  ai<{ key: AiKey }>("/keys", { method: "POST", body: JSON.stringify({ key }) }).then((r) => r.key);

export const setPreferredModel = (id: string, preferredModel: string | null) =>
  ai<{ key: AiKey }>(`/keys/${id}`, { method: "PATCH", body: JSON.stringify({ preferredModel }) }).then((r) => r.key);

export const recheckAiKey = (id: string) =>
  ai<{ key: AiKey }>(`/keys/${id}/check`, { method: "POST" }).then((r) => r.key);

export const removeAiKey = (id: string) => ai<void>(`/keys/${id}`, { method: "DELETE" });

export const saveAiSettings = (patch: Partial<AiSettings>) =>
  ai<{ settings: AiSettings }>("/settings", { method: "PATCH", body: JSON.stringify(patch) }).then((r) => r.settings);

export const explainSelection = (input: {
  quote: string;
  before: string;
  after: string;
  title?: string;
  heading?: string;
  surface: "journal" | "blog" | "knowledge";
}) => ai<Explanation>("/explain", { method: "POST", body: JSON.stringify(input) });

export const getAiUsage = (days: number) => ai<UsageSummary>(`/usage?days=${days}`);

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  xai: "xAI Grok",
};

/**
 * The same format rules the server applies (modules/ai/detect.ts), for the
 * live "looks like a Gemini key" hint while typing. The server decides; this
 * only labels.
 */
export function guessProvider(raw: string): { provider: AiProvider } | { provider: null; reason: string | null } {
  const key = raw.trim();
  if (key.length < 8) return { provider: null, reason: null };
  if (key.startsWith("sk-ant-admin")) return { provider: null, reason: "Anthropic Admin keys cannot run models" };
  if (key.startsWith("sk-ant-")) return { provider: "anthropic" };
  if (key.startsWith("sk-or-")) return { provider: null, reason: "OpenRouter keys are not supported yet" };
  if (key.startsWith("sk-admin-")) return { provider: null, reason: "OpenAI Admin keys cannot run models" };
  if (key.startsWith("xai-")) return { provider: "xai" };
  if (key.startsWith("gsk_")) return { provider: null, reason: "That is a Groq key; Grok keys start with xai-" };
  if (key.startsWith("AIza")) return { provider: "gemini" };
  if (key.startsWith("sk-")) return { provider: "openai" };
  return { provider: null, reason: "Unrecognized key format" };
}

/** "$0.000047" style, with enough digits to show something for a cheap call. */
export function formatUsd(micro: number | null | undefined): string {
  if (micro == null) return "unknown";
  const usd = micro / 1e6;
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(usd < 0.0001 ? 6 : 4)}`;
  return `$${usd.toFixed(2)}`;
}
