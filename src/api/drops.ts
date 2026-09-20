import { apiFetch } from "./client";
import type { Drop, Reply } from "./types";

export function getFeed(cursor?: string) {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return apiFetch<{ items: Drop[]; nextCursor: string | null }>(`/api/drops${qs}`);
}

export function reactToDrop(dropId: string, type: "cheer" | "save" | "repost") {
  return apiFetch<{ id: string; type: string }>(`/api/drops/${dropId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export function getReplies(dropId: string) {
  return apiFetch<{ items: Reply[]; total: number }>(`/api/drops/${dropId}/replies`);
}

export function replyToDrop(dropId: string, body: string, parentId?: string) {
  return apiFetch<Reply>(`/api/drops/${dropId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body, parentId }),
  });
}

export function likeReply(replyId: string) {
  return apiFetch<{ likeCount: number; likedByMe: boolean }>(`/api/drops/replies/${replyId}/likes`, { method: "POST" });
}

export function unlikeReply(replyId: string) {
  return apiFetch<{ likeCount: number; likedByMe: boolean }>(`/api/drops/replies/${replyId}/likes`, { method: "DELETE" });
}
