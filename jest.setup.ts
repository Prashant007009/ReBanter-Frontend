// issue #11 — global Jest setup.
//
// Exactly one substitution lives here, per tech-design.md's "Substitutions in
// jest.setup.ts" (Phase 4, frozen): expo-secure-store, because the native
// module does not exist in a Node/Jest process — there is nothing for it to
// connect to. src/session/tokenStore.ts itself is NOT substituted and stays
// fully real and exercised against this in-memory stand-in, which is what the
// "no credentials left behind" assertions in this story depend on.
//
// The network boundary is the second forced substitution tech-design.md
// names, but it is installed per-test via src/testing/fixtures/authFixtures.ts,
// not globally here — per the "Mocking strategy for Integration Points"
// section, nothing else inside the boundary (@/api/client, useSession, ...)
// is ever substituted, in here or anywhere else.

// jest.mock()'s factory may not reference an outer-scope import binding, so
// this uses require() (not an ES import) to stay inside the factory's own scope.
// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock("expo-secure-store", () => require("./src/testing/mocks/secureStoreMock").secureStoreMock);
