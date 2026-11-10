import { apiFetch } from "./client";
import type { ExploreTile, TagStat } from "./types";

export type ExploreCategory = "all" | "loops" | "makers" | "food" | "travel" | "cars";

export function getTrending() {
  return apiFetch<{ items: TagStat[] }>("/api/roam/trending");
}

export function getExplore(cat: ExploreCategory) {
  return apiFetch<{ items: ExploreTile[] }>(`/api/roam/explore?cat=${cat}`);
}
