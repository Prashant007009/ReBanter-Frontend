import { apiFetch } from "./client";
import type { BanterListItem, Message, MessageReaction } from "./types";

export function getBanters() {
  return apiFetch<{ items: BanterListItem[] }>("/api/banters");
}

export function getMessages(banterId: string) {
  return apiFetch<{ items: Message[] }>(`/api/banters/${banterId}/messages`);
}

export function sendMessage(
  banterId: string,
  input: { body?: string; imageUrl?: string; kind?: "text" | "image" | "sticker" }
) {
  return apiFetch<Message>(`/api/banters/${banterId}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sendTyping(banterId: string) {
  return apiFetch<void>(`/api/banters/${banterId}/typing`, { method: "POST" });
}

export function reactToMessage(messageId: string, emoji: string) {
  return apiFetch<{ reactions: MessageReaction[] }>(`/api/banters/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export function unreactToMessage(messageId: string) {
  return apiFetch<{ reactions: MessageReaction[] }>(`/api/banters/messages/${messageId}/reactions`, {
    method: "DELETE",
  });
}

export function createBanter(userId: string) {
  return apiFetch<{ id: string; isGroup: boolean; title: string | null }>("/api/banters", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}
