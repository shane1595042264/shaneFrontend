import { getAuthHeaders } from "./auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface LoanEntry {
  id: string;
  userId: string;
  borrowerName: string;
  amount: number;
  currency: string;
  description: string | null;
  status: "outstanding" | "repaid";
  repaidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanInput {
  borrowerName: string;
  amount: string | number;
  currency?: string;
  description?: string | null;
}

export interface UpdateLoanInput {
  borrowerName?: string;
  amount?: string | number;
  currency?: string;
  description?: string | null;
  status?: "outstanding" | "repaid";
}

async function unwrapError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || `${fallback}: ${res.status}`);
}

export async function fetchLoans(): Promise<LoanEntry[]> {
  const res = await fetch(`${API_URL}/api/loans`, { headers: getAuthHeaders() });
  if (!res.ok) await unwrapError(res, "Failed to fetch loans");
  const data = await res.json();
  return data.entries as LoanEntry[];
}

export async function createLoan(input: CreateLoanInput): Promise<LoanEntry> {
  const res = await fetch(`${API_URL}/api/loans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) await unwrapError(res, "Failed to create loan");
  const data = await res.json();
  return data.entry as LoanEntry;
}

export async function updateLoan(id: string, patch: UpdateLoanInput): Promise<LoanEntry> {
  const res = await fetch(`${API_URL}/api/loans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await unwrapError(res, "Failed to update loan");
  const data = await res.json();
  return data.entry as LoanEntry;
}

export async function deleteLoan(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/loans/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) await unwrapError(res, "Failed to delete loan");
}
