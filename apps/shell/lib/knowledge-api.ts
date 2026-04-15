const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

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
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeConnection {
  id: string;
  fromWordId: string;
  toWordId: string;
  connectionType: string;
  note: string | null;
  createdAt: string;
}

// Smart note input — AI classifies and creates entry
export async function submitNote(text: string): Promise<{ entry: KnowledgeEntry; category: string }> {
  const res = await fetch(`${API_URL}/api/knowledge/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to classify note");
  }
  return res.json();
}

export async function fetchEntries(params?: {
  language?: string;
  label?: string;
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<KnowledgeEntry[]> {
  const query = new URLSearchParams();
  if (params?.language) query.set("language", params.language);
  if (params?.label) query.set("label", params.label);
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(`${API_URL}/api/knowledge/entries?${query}`);
  if (!res.ok) throw new Error("Failed to fetch entries");
  const data = await res.json();
  return data.entries;
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create entry");
  }
  const data = await res.json();
  return data.entry;
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete entry");
}

export async function enrichEntryApi(id: string): Promise<KnowledgeEntry> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/${id}/enrich`, {
    method: "POST",
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
    headers: { "Content-Type": "application/json" },
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
