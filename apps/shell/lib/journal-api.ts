import type { DiaryEntry, NormalizedActivity, SuggestionResponse, LearnedFact } from "@shane/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function fetchEntries(): Promise<DiaryEntry[]> {
  const res = await fetch(`${API_URL}/api/journal/entries`);
  if (!res.ok) throw new Error(`Failed to fetch entries: ${res.status}`);
  return res.json();
}

export async function fetchEntry(date: string): Promise<DiaryEntry> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}`);
  if (!res.ok) throw new Error(`Failed to fetch entry: ${res.status}`);
  return res.json();
}

export async function fetchActivities(date: string): Promise<NormalizedActivity[]> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/activities`);
  if (!res.ok) throw new Error(`Failed to fetch activities: ${res.status}`);
  return res.json();
}

export async function submitSuggestion(
  date: string,
  suggestion: string
): Promise<SuggestionResponse> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suggestion }),
  });
  if (!res.ok) throw new Error(`Failed to submit suggestion: ${res.status}`);
  return res.json();
}

export async function fetchFacts(): Promise<LearnedFact[]> {
  const res = await fetch(`${API_URL}/api/journal/facts`);
  if (!res.ok) throw new Error(`Failed to fetch facts: ${res.status}`);
  return res.json();
}
