import { getAuthHeaders } from "./auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface EvaluationResult {
  product_name: string;
  price: number;
  generic_category: string;
  is_entertainment: boolean;
  avatar_url: string | null;
  balance: number;
  last_month_spend: number;
  remaining_budget: number;
  threshold: number | null;
  roll: number | null;
  result: "approved" | "denied" | "necessity" | "banned" | "too_expensive";
  banned_until: string | null;
}

export interface BudgetInfo {
  connected: boolean;
  balance: number | null;
  last_month_spend: number | null;
  remaining_budget: number | null;
}

export interface Decision {
  id: string;
  url: string | null;
  productName: string;
  price: number;
  genericCategory: string;
  isEntertainment: boolean;
  avatarUrl: string | null;
  balanceAtTime: number | null;
  remainingBudget: number | null;
  threshold: number | null;
  roll: number | null;
  result: string;
  createdAt: string;
}

export interface Ban {
  id: number;
  genericCategory: string;
  bannedAt: string;
  expiresAt: string;
}

interface BudgetOverride {
  override_balance?: number;
  override_last_month_spend?: number;
}

export async function evaluateProduct(url: string, overrides?: BudgetOverride): Promise<EvaluationResult> {
  const res = await fetch(`${API_URL}/api/rng/evaluate`, { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ url, ...overrides }) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || `Evaluation failed: ${res.status}`) as any;
    error.needsManual = !!err.needs_manual;
    throw error;
  }
  return res.json();
}

export async function evaluateManual(productName: string, price: number, overrides?: BudgetOverride): Promise<EvaluationResult> {
  const res = await fetch(`${API_URL}/api/rng/evaluate`, { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ product_name: productName, price, ...overrides }) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Evaluation failed: ${res.status}`); }
  return res.json();
}

export async function fetchBudget(): Promise<BudgetInfo> {
  const res = await fetch(`${API_URL}/api/rng/budget`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch budget");
  return res.json();
}

export async function fetchHistory(): Promise<Decision[]> {
  const res = await fetch(`${API_URL}/api/rng/history`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch history");
  const data = await res.json();
  return data.decisions;
}

export async function fetchBans(): Promise<Ban[]> {
  const res = await fetch(`${API_URL}/api/rng/bans`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch bans");
  const data = await res.json();
  return data.bans;
}

export async function createPlaidLinkToken(): Promise<string> {
  const res = await fetch(`${API_URL}/api/rng/plaid/link-token`, { method: "POST", headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to create link token");
  const data = await res.json();
  return data.link_token;
}

export async function exchangePlaidToken(publicToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/rng/plaid/exchange`, { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ public_token: publicToken }) });
  if (!res.ok) throw new Error("Failed to exchange token");
}
