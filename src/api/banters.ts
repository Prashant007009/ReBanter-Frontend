import { apiFetch } from "./client";
import { cachedBanterKey, openBanterKey, shareBanterKey } from "@/crypto/banterKeys";
import { currentIdentity } from "@/crypto/identityStore";
import { decryptMessage, encryptMessage } from "@/crypto/e2e";
import type { BanterListItem, EncryptedMessage, Message, MessagePage, MessageReaction } from "./types";

// Message content is encrypted/decrypted here, so screens only ever see
// plaintext `Message`s and the server only ever sees ciphertext.

/** Decrypt a message from the wire with the cached banter key (see `ensureBanterKey`). */
export function openMessage(raw: EncryptedMessage): Message {
  const { ciphertext, keyId, ...rest } = raw;
  const key = cachedBanterKey(raw.banterId);
  if (key && key.keyId === keyId) {
    try {
      const content = decryptMessage(key.key, { banterId: raw.banterId, keyId, senderId: raw.senderId, kind: raw.kind }, ciphertext);
      return { ...rest, ...content };
    } catch {
      // Falls through: tampered, or sealed with a key this device doesn't hold.
    }
  }
  return { ...rest, body: null, imageUrl: null, undecryptable: true };
}

type EncryptedBanterListItem = Omit<BanterListItem, "lastMessage"> & {
  keyId: string | null;
  myWrappedKey: string | null;
  awaitingKey: { userId: string; publicKey: string }[];
  lastMessage: EncryptedMessage | null;
};

/**
 * Also hands this device's banter keys to any members still waiting for one
 * (e.g. they set up E2E after the key was made), so they can read the whole
 * history without anyone having to reopen that particular thread.
 */
export async function getBanters() {
  const res = await apiFetch<{ items: EncryptedBanterListItem[] }>("/api/banters");
  return {
    items: res.items.map(({ keyId, myWrappedKey, awaitingKey, lastMessage, ...b }): BanterListItem => {
      const key = openBanterKey(b.id, keyId, myWrappedKey);
      if (key && awaitingKey.length > 0) shareBanterKey(b.id, key, awaitingKey).catch(() => {});
      return { ...b, lastMessage: lastMessage ? openMessage(lastMessage) : null };
    }),
  };
}

/** Latest page when `before` is omitted; otherwise the page just older than that message. */
export async function getMessages(banterId: string, before?: string): Promise<MessagePage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  const res = await apiFetch<Omit<MessagePage, "items"> & { items: EncryptedMessage[] }>(`/api/banters/${banterId}/messages${query}`);
  return { ...res, items: res.items.map(openMessage) };
}

export async function sendMessage(
  banterId: string,
  input: { body?: string; imageUrl?: string; kind?: "text" | "image" | "sticker" }
): Promise<Message> {
  const me = currentIdentity();
  const key = cachedBanterKey(banterId);
  if (!me || !key) throw new Error("Encryption isn't ready for this banter yet");
  const kind = input.kind ?? "text";
  const content = { body: input.body ?? null, imageUrl: input.imageUrl ?? null };
  const ciphertext = encryptMessage(key.key, { banterId, keyId: key.keyId, senderId: me.userId, kind }, content);
  const raw = await apiFetch<EncryptedMessage>(`/api/banters/${banterId}/messages`, {
    method: "POST",
    body: JSON.stringify({ kind, ciphertext, keyId: key.keyId }),
  });
  return openMessage(raw);
}

export type Presence = { userId: string; online: boolean; lastSeenAt: string | null };

/** Other participants' online status; also subscribes this user to live `presence` events for them. */
export function getPresence(banterId: string) {
  return apiFetch<{ items: Presence[] }>(`/api/banters/${banterId}/presence`);
}

/** Mark the other participants' messages as seen (sends them read receipts). */
export function markSeen(banterId: string) {
  return apiFetch<void>(`/api/banters/${banterId}/seen`, { method: "POST" });
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
