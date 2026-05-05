import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const EMOJI_SET = ["+1", "-1", "laugh", "heart", "hooray", "rocket", "eyes", "confused"] as const;
export type Emoji = typeof EMOJI_SET[number];

export const EMOJI_GLYPHS: Record<Emoji, string> = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  heart: "❤️",
  hooray: "🎉",
  rocket: "🚀",
  eyes: "👀",
  confused: "😕",
};

export async function toggleEntryReaction(date: string, emoji: Emoji): Promise<"added" | "removed"> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/reactions`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) throw new Error("Failed to toggle reaction");
  return (await res.json()).result;
}

export async function toggleCommentReaction(commentId: string, emoji: Emoji): Promise<"added" | "removed"> {
  const res = await fetch(`${API_URL}/api/journal/comments/${commentId}/reactions`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) throw new Error("Failed to toggle reaction");
  return (await res.json()).result;
}

export interface ReactionSummaryRow {
  emoji: Emoji;
  count: number;
}

export interface ReactionState {
  summary: ReactionSummaryRow[];
  mine: Emoji[];
}

export async function getEntryReactions(date: string): Promise<ReactionState> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/reactions`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return { summary: [], mine: [] };
  return res.json();
}

export async function getCommentReactions(commentId: string): Promise<ReactionState> {
  const res = await fetch(`${API_URL}/api/journal/comments/${commentId}/reactions`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return { summary: [], mine: [] };
  return res.json();
}
