import { apiFetch } from "./client";
import type { Room, Media, UserSummary } from "./types";

export interface Loop {
  id: string;
  author: UserSummary;
  caption: string | null;
  durationSec: number;
  audioLabel: string | null;
  media: Media[];
}

export function getRooms() {
  return apiFetch<{ items: Room[]; roamingNow: number }>("/api/rooms");
}

export function joinRoom(roomId: string, join: boolean) {
  return apiFetch<Room>(`/api/rooms/${roomId}/join`, { method: join ? "POST" : "DELETE" });
}

export function getRoomLoops(roomId: string) {
  return apiFetch<{ items: Loop[] }>(`/api/rooms/${roomId}/loops`);
}

export function tuneIn(roomId: string) {
  return apiFetch<Room>(`/api/rooms/${roomId}/tune-in`, { method: "POST" });
}
