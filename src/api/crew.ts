import { apiFetch } from "./client";
import type { UserSummary } from "./types";

export function getMyCrew() {
  return apiFetch<UserSummary[]>("/api/crew");
}

export function sendCrewRequest(userId: string) {
  return apiFetch(`/api/crew/requests`, { method: "POST", body: JSON.stringify({ userId }) });
}

export function acceptCrewRequest(userId: string) {
  return apiFetch(`/api/crew/requests/${userId}/accept`, { method: "POST" });
}

export function skipCrewRequest(userId: string) {
  return apiFetch(`/api/crew/requests/${userId}/skip`, { method: "POST" });
}

/** Take back a crew request you sent. */
export function cancelCrewRequest(userId: string) {
  return apiFetch(`/api/crew/requests/${userId}`, { method: "DELETE" });
}

/** Leave someone's crew. */
export function leaveCrew(userId: string) {
  return apiFetch(`/api/crew/${userId}`, { method: "DELETE" });
}
