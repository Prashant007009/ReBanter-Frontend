import { apiFetch } from "./client";
import type { MomentGroup } from "./types";

export function getMoments() {
  return apiFetch<{ items: MomentGroup[] }>("/api/moments");
}

export function createMoment(input: { mediaUrl?: string; caption?: string; captionBg?: string; captionInk?: string }) {
  return apiFetch<{ id: string }>("/api/moments", { method: "POST", body: JSON.stringify(input) });
}

export function markMomentViewed(momentId: string) {
  return apiFetch<void>(`/api/moments/${momentId}/view`, { method: "POST" });
}

export function likeMoment(momentId: string, liked: boolean) {
  return apiFetch<void>(`/api/moments/${momentId}/like`, { method: liked ? "POST" : "DELETE" });
}
