import { apiFetch } from "./client";
import type { Reply, StreamDrop, StreamTab } from "./types";

export function getFeed(tab: StreamTab = "forYou", cursor?: string, tag?: string) {
  const qs = new URLSearchParams({ tab, ...(cursor ? { cursor } : {}), ...(tag ? { tag: tag.replace(/^#/, "") } : {}) });
  return apiFetch<{ items: StreamDrop[]; nextCursor: string | null }>(`/api/drops?${qs}`);
}

export function getDrop(dropId: string) {
  return apiFetch<StreamDrop>(`/api/drops/${dropId}`);
}

export type NewDrop =
  | { kind: "post"; caption?: string; location?: string; media: { url: string; kind: "image" | "video" }[] }
  | { kind: "take"; body: string; caption?: string }
  | { kind: "poll"; body: string; options: string[]; caption?: string };

export function createDrop(input: NewDrop) {
  return apiFetch<StreamDrop>("/api/drops", { method: "POST", body: JSON.stringify(input) });
}

type ReactionType = "cheer" | "save" | "repost";

export function reactToDrop(dropId: string, type: ReactionType) {
  return apiFetch<{ id: string; type: string }>(`/api/drops/${dropId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export function unreactToDrop(dropId: string, type: ReactionType) {
  return apiFetch<void>(`/api/drops/${dropId}/reactions/${type}`, { method: "DELETE" });
}

export function votePoll(dropId: string, optionId: string) {
  return apiFetch<StreamDrop>(`/api/drops/${dropId}/vote`, { method: "POST", body: JSON.stringify({ optionId }) });
}

export function setStance(dropId: string, stance: "facts" | "cap" | null) {
  return apiFetch<StreamDrop>(`/api/drops/${dropId}/stance`, { method: "PUT", body: JSON.stringify({ stance }) });
}

/** "Not interested" (or Report, with `report`) — the drop leaves your Stream. */
export function hideDrop(dropId: string, report = false) {
  return apiFetch<void>(`/api/drops/${dropId}/hide`, { method: "POST", body: JSON.stringify({ report }) });
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
