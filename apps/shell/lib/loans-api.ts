import { getAuthHeaders } from "./auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// "owed_to_me" = someone borrowed from you; "i_owe" = you owe someone else.
export type LoanDirection = "owed_to_me" | "i_owe";

export interface LoanEntry {
  id: string;
  userId: string;
  borrowerName: string;
  amount: number;
  currency: string;
  description: string | null;
  status: "outstanding" | "repaid";
  direction: LoanDirection;
  repaidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanInput {
  borrowerName: string;
  amount: string | number;
  currency?: string;
  description?: string | null;
  direction?: LoanDirection;
}

export interface UpdateLoanInput {
  borrowerName?: string;
  amount?: string | number;
  currency?: string;
  description?: string | null;
  status?: "outstanding" | "repaid";
  direction?: LoanDirection;
}

async function unwrapError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  // SHAN-451: every backend error is now { error: string }, and validation
  // failures add a structured { details: [{ path?, message }] }. Prefer the
  // per-field details so the form shows "amount: Expected number" rather than
  // the folded summary; fall back to the plain message otherwise.
  const details = err.details;
  if (Array.isArray(details) && details.length > 0) {
    const message = details
      .map((d: { path?: string; message?: string }) =>
        d.path && d.message ? `${d.path}: ${d.message}` : d.message
      )
      .filter(Boolean)
      .join("; ");
    if (message) throw new Error(message);
  }
  if (typeof err.error === "string") {
    throw new Error(err.error);
  }
  throw new Error(`${fallback}: ${res.status}`);
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
