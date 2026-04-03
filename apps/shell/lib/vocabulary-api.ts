const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface VocabWord {
  id: string;
  word: string;
  language: string;
  definition: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  labels: string[];
  aiMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface VocabConnection {
  id: string;
  fromWordId: string;
  toWordId: string;
  connectionType: string;
  note: string | null;
  createdAt: string;
}

export async function fetchWords(params?: {
  language?: string;
  label?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<VocabWord[]> {
  const query = new URLSearchParams();
  if (params?.language) query.set("language", params.language);
  if (params?.label) query.set("label", params.label);
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(`${API_URL}/api/vocabulary/words?${query}`);
  if (!res.ok) throw new Error("Failed to fetch words");
  const data = await res.json();
  return data.words;
}

export async function fetchWord(
  id: string
): Promise<{ word: VocabWord; connections: VocabConnection[]; connectedWords: VocabWord[] }> {
  const res = await fetch(`${API_URL}/api/vocabulary/words/${id}`);
  if (!res.ok) throw new Error("Failed to fetch word");
  return res.json();
}

export async function createWord(input: {
  word: string;
  language: string;
  definition?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  labels?: string[];
  autoEnrich?: boolean;
}): Promise<VocabWord> {
  const res = await fetch(`${API_URL}/api/vocabulary/words`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create word");
  }
  const data = await res.json();
  return data.word;
}

export async function updateWord(
  id: string,
  input: Partial<{
    word: string;
    language: string;
    definition: string;
    pronunciation: string;
    partOfSpeech: string;
    exampleSentence: string;
    labels: string[];
  }>
): Promise<VocabWord> {
  const res = await fetch(`${API_URL}/api/vocabulary/words/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update word");
  const data = await res.json();
  return data.word;
}

export async function deleteWord(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/vocabulary/words/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete word");
}

export async function enrichWordApi(id: string): Promise<VocabWord> {
  const res = await fetch(`${API_URL}/api/vocabulary/words/${id}/enrich`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to enrich word");
  const data = await res.json();
  return data.word;
}

export async function createConnection(input: {
  fromWordId: string;
  toWordId: string;
  connectionType: string;
  note?: string;
}): Promise<VocabConnection> {
  const res = await fetch(`${API_URL}/api/vocabulary/connections`, {
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
  const res = await fetch(`${API_URL}/api/vocabulary/connections/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete connection");
}

export async function fetchLabels(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/vocabulary/labels`);
  if (!res.ok) throw new Error("Failed to fetch labels");
  const data = await res.json();
  return data.labels;
}

export async function fetchLanguages(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/vocabulary/languages`);
  if (!res.ok) throw new Error("Failed to fetch languages");
  const data = await res.json();
  return data.languages;
}
