import { apiFetch } from "./client";
import type { Drop } from "./types";

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

export function replyToDrop(dropId: string, body: string) {
  return apiFetch(`/api/drops/${dropId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}
