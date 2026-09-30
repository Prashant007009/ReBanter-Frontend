// issue #11 — in-memory substitute for expo-secure-store.
//
// This exists ONLY because expo-secure-store's native module does not exist
// in a Node/Jest process (tech-design.md, "Substitutions in jest.setup.ts").
// It is installed globally by jest.setup.ts via jest.mock("expo-secure-store", ...)
// and is not meant to be imported or mocked again inside individual tests.
//
// src/session/tokenStore.ts stays real against this map: its branches, its
// key names and its clearTokens() call are all genuinely exercised, which is
// what every "no credentials left behind" assertion in this story rests on.

const store = new Map<string, string>();

export const secureStoreMock = {
  getItemAsync: jest.fn(async (key: string): Promise<string | null> => {
    return store.has(key) ? (store.get(key) as string) : null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string): Promise<void> => {
    store.delete(key);
  }),
};

/**
 * Test-only helper. Clears the in-memory store and mock call history between
 * test cases so tests stay independent of one another. Call this from a
 * `beforeEach` in any test file that exercises tokenStore (directly or via
 * SessionContext) on the native/iOS branch (Platform.OS !== "web", which is
 * what the single jest-expo native project preset reports).
 */
export function resetSecureStoreMock(): void {
  store.clear();
  secureStoreMock.getItemAsync.mockClear();
  secureStoreMock.setItemAsync.mockClear();
  secureStoreMock.deleteItemAsync.mockClear();
}
