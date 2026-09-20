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
  return apiFetch<{ items: Room[] }>("/api/rooms");
}

export function getRoomLoops(roomId: string) {
  return apiFetch<{ items: Loop[] }>(`/api/rooms/${roomId}/loops`);
}

export function tuneIn(roomId: string) {
  return apiFetch<Room>(`/api/rooms/${roomId}/tune-in`, { method: "POST" });
}
