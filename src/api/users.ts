import { apiFetch } from "./client";
import type { MeProfile } from "@/session/SessionContext";

export function updateMe(patch: Partial<Pick<MeProfile, "whoCanBanter" | "windDownAfterMin" | "bio" | "displayName">>) {
  return apiFetch<MeProfile>("/api/users/me", { method: "PATCH", body: JSON.stringify(patch) });
}
