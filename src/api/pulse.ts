import { apiFetch } from "./client";
import type { Notification } from "./types";

export function getPulse() {
  return apiFetch<{ items: Notification[] }>("/api/pulse");
}

export function markAllRead() {
  return apiFetch<void>("/api/pulse/read-all", { method: "POST" });
}
