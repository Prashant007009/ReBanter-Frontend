import { apiFetch } from "./client";
import type { UserSummary } from "./types";

export interface SearchResults {
  users: UserSummary[];
  rooms: { id: string; title: string; status: string; participantCount: number }[];
}

export function search(query: string) {
  return apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(query)}`);
}
