import { apiFetch } from "./client";
import type { Media, UserSummary } from "./types";

export type PickerItem = { name: string; sub: string };

/** "Add place" suggestions: your recent places, then popular ones. */
export function getPlaces(q: string) {
  return apiFetch<{ items: PickerItem[] }>(`/api/roam/places?q=${encodeURIComponent(q)}`);
}

/** "Add sound" suggestions: sounds already used on loops and drops. */
export function getSounds(q: string) {
  return apiFetch<{ items: PickerItem[] }>(`/api/roam/sounds?q=${encodeURIComponent(q)}`);
}

export function getCloseCircle() {
  return apiFetch<{ items: UserSummary[] }>("/api/users/me/close-circle");
}

export function setCloseCircle(userIds: string[]) {
  return apiFetch<{ count: number }>("/api/users/me/close-circle", { method: "PUT", body: JSON.stringify({ userIds }) });
}

export interface LoopDetail {
  id: string;
  roomId: string | null;
  caption: string | null;
  durationSec: number;
  audioLabel: string | null;
  playbackRate: number;
  trimStartSec: number | null;
  trimEndSec: number | null;
  effects: string[];
  author: UserSummary;
  media: Media[];
}

export function createLoop(input: {
  videoUrl: string;
  caption?: string;
  durationSec: number;
  audioLabel?: string;
  playbackRate: 0.5 | 1 | 2 | 3;
  trimStartSec?: number;
  trimEndSec?: number;
  effects: string[];
}) {
  return apiFetch<LoopDetail>("/api/loops", { method: "POST", body: JSON.stringify(input) });
}

export function getLoop(id: string) {
  return apiFetch<LoopDetail>(`/api/loops/${id}`);
}
