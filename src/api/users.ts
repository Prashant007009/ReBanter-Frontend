import { apiFetch } from "./client";
import type { MeProfile } from "@/session/SessionContext";
import type { Drop, PublicUserProfile } from "./types";

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
