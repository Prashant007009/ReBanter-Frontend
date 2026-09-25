import { apiFetch } from "./client";
import type { PersonResult, Room, TagStat } from "./types";

export interface SearchResults {
  users: PersonResult[];
  rooms: Room[];
  tags: TagStat[];
}

export function search(query: string) {
  return apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(query)}`);
}
