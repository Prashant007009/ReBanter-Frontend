import { apiFetch } from "./client";
import type { MeProfile } from "@/session/SessionContext";
import type { Drop, PublicUserProfile, UserSummary } from "./types";

export function updateMe(
  patch: Partial<
    Pick<MeProfile, "whoCanBanter" | "windDownAfterMin" | "bio" | "displayName" | "avatarUrl" | "coverUrl" | "link" | "isPrivate">
  >
) {
  return apiFetch<MeProfile>("/api/users/me", { method: "PATCH", body: JSON.stringify(patch) });
}

export function getUserProfile(handle: string) {
  return apiFetch<PublicUserProfile>(`/api/users/${handle}`);
}

export function getUserDrops(handle: string) {
  return apiFetch<{ items: Drop[]; locked: boolean }>(`/api/users/${handle}/drops`);
}

export type ProfileSwitch = "alerts" | "mute" | "restrict" | "block";

/** Turn one of your per-person switches on or off (drop alerts, mute, restrict, block). */
export function setProfileSwitch(handle: string, kind: ProfileSwitch, on: boolean) {
  return apiFetch<Record<ProfileSwitch, boolean>>(`/api/users/${handle}/${kind}`, { method: on ? "PUT" : "DELETE" });
}

export type ReportReason = "spam" | "harassment" | "impersonation" | "inappropriate" | "underage" | "other";

export function reportUser(handle: string, reason: ReportReason, details?: string) {
  return apiFetch<{ ok: true }>(`/api/users/${handle}/report`, { method: "POST", body: JSON.stringify({ reason, details }) });
}

export type ProfileCrewMember = UserSummary & { mutual: boolean; isYou: boolean };

export function getUserCrew(handle: string) {
  return apiFetch<{ items: ProfileCrewMember[]; locked: boolean }>(`/api/users/${handle}/crew`);
}

export type SimilarRoamer = UserSummary & { why: string; relationship: "none" | "requested" | "incoming" };

export function getSimilarRoamers(handle: string) {
  return apiFetch<{ items: SimilarRoamer[] }>(`/api/users/${handle}/similar`);
}
