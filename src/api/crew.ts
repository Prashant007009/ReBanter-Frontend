import { apiFetch } from "./client";
import type { CrewSummary } from "./types";

export function getMyCrews() {
  return apiFetch<CrewSummary[]>("/api/crew");
}

export function acceptCrewRequest(crewId: string, userId: string) {
  return apiFetch(`/api/crew/${crewId}/requests/${userId}/accept`, { method: "POST" });
}

export function skipCrewRequest(crewId: string, userId: string) {
  return apiFetch(`/api/crew/${crewId}/requests/${userId}/skip`, { method: "POST" });
}
