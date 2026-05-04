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
