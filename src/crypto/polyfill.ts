import * as ExpoCrypto from "expo-crypto";

// @noble/* draw randomness from `crypto.getRandomValues`. Browsers have it;
// React Native may not, so back it with expo-crypto's native CSPRNG. Must be
// imported before anything that generates keys or nonces.
const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (typeof g.crypto?.getRandomValues !== "function") {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: ExpoCrypto.getRandomValues };
}
