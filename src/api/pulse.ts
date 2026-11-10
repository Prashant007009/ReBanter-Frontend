import { apiFetch } from "./client";
import { realtimeSocket } from "@/realtime/socket";
import type { Notification, PulseWeek } from "./types";

export function getPulse() {
  return apiFetch<{ items: Notification[] }>("/api/pulse");
}

export function getPulseWeek() {
  // The server buckets days in the viewer's local time.
  return apiFetch<PulseWeek>(`/api/pulse/week?tz=${-new Date().getTimezoneOffset()}`);
}

export async function markRead(ids: string[]) {
  if (ids.length === 0) return;
  await apiFetch<void>("/api/pulse/read", { method: "POST", body: JSON.stringify({ ids }) });
  realtimeSocket.emitLocal("pulse.changed");
}

export async function markAllRead() {
  await apiFetch<void>("/api/pulse/read-all", { method: "POST" });
  realtimeSocket.emitLocal("pulse.changed");
}
