import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface KnowledgeEntrySource {
  app: string | null;
  book: string | null;
  author: string | null;
  location: string | null;
  rawContext: string | null;
}

export interface KnowledgeEntry {
  id: string;
  word: string;
  language: string;
  category: string;
  definition: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  labels: string[];
  aiMetadata: Record<string, unknown> | null;
  source: KnowledgeEntrySource | null;
  // Location-memorization technique (SHAN-339): distinct places this card has been
  // practiced. Once 7 are marked, longTermMemorized flips true (derived server-side).
  memorizationLocations: string[];
  longTermMemorized: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Distinct locations required before a knowledge card is long-term memorized. */
export const LONG_TERM_THRESHOLD = 7;

export interface KnowledgeConnection {
  id: string;
  fromWordId: string;
  toWordId: string;
  connectionType: string;
  note: string | null;
  createdAt: string;
}

// Smart note input — AI classifies, optionally records provenance, creates entry.
// Returns the first (and only) created entry. The endpoint also accepts a batch
// shape ({ notes: [...] }) for external clients like Nibbler.
export async function submitNote(
  text: string,
  source?: string | KnowledgeEntrySource
): Promise<{ entry: KnowledgeEntry }> {
  const body: Record<string, unknown> = { text };
  if (source !== undefined) body.source = source;

  const res = await fetch(`${API_URL}/api/knowledge/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to classify note");
  }
  const data = (await res.json()) as { entries: KnowledgeEntry[] };
  return { entry: data.entries[0] };
}

export interface PaginatedKnowledgeEntries {
  entries: KnowledgeEntry[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchEntries(params?: {
  language?: string;
  label?: string;
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<PaginatedKnowledgeEntries> {
  const query = new URLSearchParams();
  if (params?.language) query.set("language", params.language);
  if (params?.label) query.set("label", params.label);
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(`${API_URL}/api/knowledge/entries?${query}`, {
    signal: params?.signal,
  });
  if (!res.ok) throw new Error("Failed to fetch entries");
  return res.json();
}

/** Fetch all knowledge entries by paging through the API (100 per page). */
export async function fetchAllEntries(params?: {
  language?: string;
  label?: string;
  search?: string;
  category?: string;
  signal?: AbortSignal;
}): Promise<KnowledgeEntry[]> {
  const PAGE_SIZE = 100;
  const first = await fetchEntries({ ...params, limit: PAGE_SIZE, offset: 0 });
  const all = [...first.entries];

  let offset = first.entries.length;
  while (offset < first.total) {
    const page = await fetchEntries({ ...params, limit: PAGE_SIZE, offset });
    all.push(...page.entries);
    offset += page.entries.length;
    if (page.entries.length === 0) break;
  }

  return all;
}

export async function fetchEntry(
  id: string
): Promise<{ entry: KnowledgeEntry; connections: KnowledgeConnection[]; connectedEntries: KnowledgeEntry[] }> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/${id}`);
  if (!res.ok) throw new Error("Failed to fetch entry");
  return res.json();
}

export async function createEntry(input: {
  word: string;
  language: string;
  category?: string;
  definition?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  labels?: string[];
  autoEnrich?: boolean;
}): Promise<KnowledgeEntry> {
  const res = await fetch(`${API_URL}/api/knowledge/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create entry");
  }
  const data = await res.json();
  return data.entry;
}

export async function updateEntry(
  id: string,
  body: {
    word?: string;
    language?: string;
    category?: string;
    definition?: string;
    pronunciation?: string;
    partOfSpeech?: string;
    exampleSentence?: string;
    labels?: string[];
    memorizationLocations?: string[];
  }
): Promise<KnowledgeEntry> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update entry");
  }
  const data = await res.json();
  return data.entry;
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete entry");
  }
}

export interface BulkDeleteResult {
  deleted: string[];
  denied: string[];
  notFound: string[];
}

export async function bulkDeleteEntries(ids: string[]): Promise<BulkDeleteResult> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete entries");
  }
  return res.json();
}

export async function enrichEntryApi(id: string): Promise<KnowledgeEntry> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/${id}/enrich`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Failed to enrich entry");
  const data = await res.json();
  return data.entry;
}

export async function createConnection(input: {
  fromWordId: string;
  toWordId: string;
  connectionType: string;
  note?: string;
}): Promise<KnowledgeConnection> {
  const res = await fetch(`${API_URL}/api/knowledge/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create connection");
  }
  const data = await res.json();
  return data.connection;
}

export async function deleteConnection(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/knowledge/connections/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error("Failed to delete connection");
}

export async function fetchLabels(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/knowledge/labels`);
  if (!res.ok) throw new Error("Failed to fetch labels");
  const data = await res.json();
  return data.labels;
}

export async function fetchLanguages(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/knowledge/languages`);
  if (!res.ok) throw new Error("Failed to fetch languages");
  const data = await res.json();
  return data.languages;
}

export async function fetchCategories(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/knowledge/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  const data = await res.json();
  return data.categories;
}
