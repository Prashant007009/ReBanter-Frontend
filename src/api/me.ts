import { apiFetch } from "./client";
import type { MeProfile } from "@/session/SessionContext";
import type { StreamDrop, UserSummary } from "./types";

export type MePatch = Partial<Pick<MeProfile, "displayName" | "handle" | "bio" | "avatarUrl" | "coverUrl" | "isPrivate" | "vibe">>;

export function updateMe(patch: MePatch) {
  return apiFetch<MeProfile>("/api/users/me", { method: "PATCH", body: JSON.stringify(patch) });
}

export function checkHandle(handle: string) {
  return apiFetch<{ available: boolean; reason: string | null }>(`/api/users/handle-available?handle=${encodeURIComponent(handle)}`);
}

export interface Insights {
  days: { date: string; count: number }[];
  total: number;
  /** Week-over-week change, or null when there's nothing to compare against. */
  changePct: number | null;
}

export function getInsights() {
  return apiFetch<Insights>(`/api/users/me/insights?tz=${-new Date().getTimezoneOffset()}`);
}

export function getMyCrewWithSince() {
  return apiFetch<{ items: (UserSummary & { since: string })[] }>("/api/users/me/crew");
}

export interface ProfilePin {
  id: string;
  emoji: string;
  label: string;
  color: string;
}

export function getPins() {
  return apiFetch<{ items: ProfilePin[] }>("/api/users/me/pins");
}

export function addPin(pin: Omit<ProfilePin, "id">) {
  return apiFetch<ProfilePin>("/api/users/me/pins", { method: "POST", body: JSON.stringify(pin) });
}

export function removePin(id: string) {
  return apiFetch<void>(`/api/users/me/pins/${id}`, { method: "DELETE" });
}

/** Someone's drops as full Stream cards, pinned drop first. */
export function getUserDrops(handle: string) {
  return apiFetch<{ items: (StreamDrop & { pinnedAt?: string | null })[]; locked: boolean }>(`/api/users/${handle}/drops`);
}

export interface UserLoop {
  id: string;
  roomId: string | null;
  caption: string | null;
  audioLabel: string | null;
  durationSec: number;
  coverUrl: string | null;
  createdAt: string;
}

export function getUserLoops(handle: string) {
  return apiFetch<{ items: UserLoop[] }>(`/api/users/${handle}/loops`);
}

export function pinDrop(dropId: string, pinned: boolean) {
  return apiFetch<{ pinned: boolean }>(`/api/drops/${dropId}/pin`, { method: "PUT", body: JSON.stringify({ pinned }) });
}

export function deleteDrop(dropId: string) {
  return apiFetch<void>(`/api/drops/${dropId}`, { method: "DELETE" });
}

/** Drops you've saved, or the ones you've cheered ("Your activity"). */
export function getCollection(type: "save" | "cheer") {
  return apiFetch<{ items: StreamDrop[] }>(`/api/drops/collection?type=${type}`);
}
