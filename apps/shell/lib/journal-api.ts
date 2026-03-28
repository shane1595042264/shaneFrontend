import type { DiaryEntry, NormalizedActivity, SuggestionResponse, LearnedFact } from "@shane/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
// Journal reads from prod backend even on staging — one AI voice, one diary
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

export interface PaginatedEntries {
  entries: DiaryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchEntries(
  opts: { limit?: number; offset?: number } = {}
): Promise<PaginatedEntries> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();
  const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch entries: ${res.status}`);
  return res.json();
}

export async function fetchEntry(date: string): Promise<{ entry: DiaryEntry; activities: NormalizedActivity[] }> {
  const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries/${date}`);
  if (!res.ok) throw new Error(`Failed to fetch entry: ${res.status}`);
  return res.json();
}

export async function fetchActivities(date: string): Promise<NormalizedActivity[]> {
  const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries/${date}/activities`);
  if (!res.ok) throw new Error(`Failed to fetch activities: ${res.status}`);
  const data = await res.json();
  return data.activities ?? data;
}

export async function submitSuggestion(
  date: string,
  suggestion: string
): Promise<SuggestionResponse> {
  const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries/${date}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suggestion }),
  });
  if (!res.ok) throw new Error(`Failed to submit suggestion: ${res.status}`);
  return res.json();
}

export async function fetchFacts(): Promise<LearnedFact[]> {
  const res = await fetch(`${JOURNAL_API_URL}/api/journal/facts`);
  if (!res.ok) throw new Error(`Failed to fetch facts: ${res.status}`);
  const data = await res.json();
  return data.facts ?? data;
}
