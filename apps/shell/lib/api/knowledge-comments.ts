import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface KnowledgeCommentAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface KnowledgeComment {
  id: string;
  entryId: string;
  parentCommentId: string | null;
  authorId: string;
  author: KnowledgeCommentAuthor | null;
  content: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listKnowledgeComments(entryId: string): Promise<KnowledgeComment[]> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/${entryId}/comments`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load comments");
  return (await res.json()).comments;
}

export async function postKnowledgeComment(
  entryId: string,
  content: string,
  parentCommentId?: string
): Promise<KnowledgeComment> {
  const res = await fetch(`${API_URL}/api/knowledge/entries/${entryId}/comments`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ content, parent_comment_id: parentCommentId }),
  });
  if (!res.ok) throw new Error("Failed to post comment");
  return (await res.json()).comment;
}

export async function editKnowledgeComment(
  id: string,
  content: string
): Promise<KnowledgeComment> {
  const res = await fetch(`${API_URL}/api/knowledge/comments/${id}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to edit comment");
  return (await res.json()).comment;
}

export async function deleteKnowledgeComment(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/knowledge/comments/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete comment");
}
