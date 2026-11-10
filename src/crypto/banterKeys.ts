import { apiFetch } from "@/api/client";
import { currentIdentity } from "./identityStore";
import { generateBanterKey, toBase64, unwrapBanterKey, wrapBanterKey } from "./e2e";

export type BanterKey = { keyId: string; key: Uint8Array };

type KeyState = {
  keyId: string | null;
  myWrappedKey: string | null;
  participants: { userId: string; publicKey: string | null; hasKey: boolean }[];
};

const cache = new Map<string, BanterKey>();

export function clearBanterKeys(): void {
  cache.clear();
}

export function cachedBanterKey(banterId: string): BanterKey | null {
  return cache.get(banterId) ?? null;
}

/** Open (and cache) the banter key from the caller's sealed copy. Null if it can't be opened. */
export function openBanterKey(banterId: string, keyId: string | null, wrapped: string | null): BanterKey | null {
  const hit = cache.get(banterId);
  if (hit && hit.keyId === keyId) return hit;
  const me = currentIdentity();
  if (!me || !keyId || !wrapped) return null;
  try {
    const opened = { keyId, key: unwrapBanterKey(wrapped, keyId, me.identity) };
    cache.set(banterId, opened);
    return opened;
  } catch {
    return null;
  }
}

function postKeys(banterId: string, keyId: string, wraps: { userId: string; wrappedKey: string }[]) {
  return apiFetch<KeyState>(`/api/banters/${banterId}/keys`, { method: "POST", body: JSON.stringify({ keyId, wraps }) });
}

/**
 * Make sure this device holds the banter's message key:
 * - no key yet → create one and seal it to every participant with a public key
 *   (if another member races us, theirs wins and we retry with it);
 * - key exists and we have a sealed copy → open it, then hand sealed copies to
 *   any members who set up encryption after the key was made;
 * - key exists but nobody has sealed it to us yet → null (wait for a member).
 */
export async function ensureBanterKey(banterId: string, attempt = 0): Promise<BanterKey | null> {
  const me = currentIdentity();
  if (!me) return null;
  const state = await apiFetch<KeyState>(`/api/banters/${banterId}/keys`);

  if (!state.keyId) {
    const fresh = generateBanterKey();
    const myPublicKey = toBase64(me.identity.publicKey);
    const wraps = state.participants
      .map((p) => ({ userId: p.userId, publicKey: p.userId === me.userId ? myPublicKey : p.publicKey }))
      .filter((p): p is { userId: string; publicKey: string } => !!p.publicKey)
      .map((p) => ({ userId: p.userId, wrappedKey: wrapBanterKey(fresh.key, fresh.keyId, p.publicKey) }));
    try {
      await postKeys(banterId, fresh.keyId, wraps);
      cache.set(banterId, fresh);
      return fresh;
    } catch (err) {
      if (attempt > 0) throw err;
      return ensureBanterKey(banterId, attempt + 1);
    }
  }

  const opened = openBanterKey(banterId, state.keyId, state.myWrappedKey);
  if (!opened) return null;

  const missing = state.participants.filter((p): p is typeof p & { publicKey: string } => !p.hasKey && !!p.publicKey);
  if (missing.length > 0) shareBanterKey(banterId, opened, missing).catch(() => {});
  return opened;
}

/** Seal the banter key to members who don't have a copy yet (the server ignores ones already served). */
export async function shareBanterKey(banterId: string, key: BanterKey, recipients: { userId: string; publicKey: string }[]) {
  await postKeys(
    banterId,
    key.keyId,
    recipients.map((p) => ({ userId: p.userId, wrappedKey: wrapBanterKey(key.key, key.keyId, p.publicKey) }))
  );
}
