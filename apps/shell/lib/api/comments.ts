import { getAuthHeaders } from "@/lib/auth-api";
import type { ReactionState } from "@/lib/api/reactions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface CommentAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  entryId: string;
  parentCommentId: string | null;
  authorId: string;
  authorTimezone?: string | null;
  author: CommentAuthor | null;
  content: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reactions?: ReactionState;
}

export async function listComments(date: string): Promise<Comment[]> {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/comments`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load comments");
  return (await res.json()).comments;
}

export async function postComment(date: string, content: string, parentCommentId?: string) {
  const res = await fetch(`${API_URL}/api/journal/entries/${date}/comments`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ content, parent_comment_id: parentCommentId }),
  });
  if (!res.ok) throw new Error("Failed to post comment");
  return (await res.json()).comment as Comment;
}

export async function editComment(id: string, content: string) {
  const res = await fetch(`${API_URL}/api/journal/comments/${id}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to edit comment");
  return (await res.json()).comment as Comment;
}

export async function deleteComment(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/journal/comments/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete comment");
}
