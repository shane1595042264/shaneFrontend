import type { DiaryEntry, NormalizedActivity, SuggestionResponse, LearnedFact } from "@shane/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
// Journal reads from prod backend even on staging — one AI voice, one diary
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

export async function fetchEntries(): Promise<DiaryEntry[]> {
  const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries`);
  if (!res.ok) throw new Error(`Failed to fetch entries: ${res.status}`);
  const data = await res.json();
  return data.entries ?? data;
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
