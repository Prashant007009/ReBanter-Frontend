import { deleteItem, getItem, setItem } from "@/session/tokenStore";
import { fromBase64, identityFromPrivateKey, toBase64, type Identity } from "./e2e";

// The user's E2E private key lives only on this device (SecureStore on
// native; localStorage on the web test target), keyed by user id.

const keyFor = (userId: string) => `rebanter.e2eKey.${userId}`;
let current: { userId: string; identity: Identity } | null = null;

export async function saveIdentity(userId: string, identity: Identity): Promise<void> {
  await setItem(keyFor(userId), toBase64(identity.privateKey));
  current = { userId, identity };
}

export async function loadIdentity(userId: string): Promise<Identity | null> {
  if (current?.userId === userId) return current.identity;
  const stored = await getItem(keyFor(userId));
  if (!stored) return null;
  current = { userId, identity: identityFromPrivateKey(fromBase64(stored)) };
  return current.identity;
}

/** The identity unlocked for the signed-in user, if any. */
export function currentIdentity(): { userId: string; identity: Identity } | null {
  return current;
}

export async function forgetIdentity(userId: string): Promise<void> {
  current = null;
  await deleteItem(keyFor(userId));
}
