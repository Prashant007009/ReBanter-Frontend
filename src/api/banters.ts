import { apiFetch } from "./client";
import type { BanterListItem, Message } from "./types";

export function getBanters() {
  return apiFetch<{ items: BanterListItem[] }>("/api/banters");
}

export function getMessages(banterId: string) {
  return apiFetch<{ items: Message[] }>(`/api/banters/${banterId}/messages`);
}

export function sendMessage(banterId: string, body: string) {
  return apiFetch<Message>(`/api/banters/${banterId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function createBanter(userId: string) {
  return apiFetch<{ id: string; isGroup: boolean; title: string | null }>("/api/banters", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}
