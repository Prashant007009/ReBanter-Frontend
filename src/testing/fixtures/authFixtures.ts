// issue #11 — shared network-boundary fixtures for the auth sign-in / sign-up
// integration and unit tests.
//
// Per tech-design.md's "Mocking strategy for Integration Points" (Phase 4,
// frozen), the network boundary is the ONE thing this story's tests are
// allowed to substitute besides expo-secure-store. This file substitutes it
// by replacing `global.fetch` with a queued jest mock returning small
// duck-typed response objects — `{ ok, status, json() }` — which is exactly
// the surface src/api/client.ts's rawFetch/apiFetch consume. No mocking
// library (msw, nock, ...) is added: tech-design.md's devDependency list is
// closed to jest/jest-expo/RNTL/react-test-renderer/@types/jest only, and a
// hand-rolled fetch queue is sufficient for a two-endpoint client flow.
//
// Test-only credentials. TEST_PASSWORD etc. below are fixture values used
// only against the substituted network boundary in this test suite — they
// are never sent to, or valid against, any real backend, and must never be
// reused as real account credentials.

export type AuthField = "handle" | "displayName" | "password";

export const TEST_HANDLE = "zoe.b";
export const TEST_DISPLAY_NAME = "Zoe B";
export const TEST_PASSWORD = "correct-horse-battery"; // fixture only; satisfies the >=8 char rule
export const TEST_ACCESS_TOKEN = "test-access-token";
export const TEST_REFRESH_TOKEN = "test-refresh-token";
export const TEST_USER_ID = "user-1";

/** Matches MeProfile (src/session/SessionContext.tsx) — the GET /api/users/me success body. */
export const meProfileFixture = {
  id: TEST_USER_ID,
  handle: TEST_HANDLE,
  displayName: TEST_DISPLAY_NAME,
  bio: null,
  avatarUrl: null,
  coverUrl: null,
  link: null,
  isPrivate: false,
  whoCanBanter: "EVERYONE" as const,
  windDownAfterMin: null,
  quietHoursStart: null,
  quietHoursEnd: null,
  stats: { drops: 0, crew: 0 },
};

/** Matches the assumed AuthResponse shape (tech-design.md Data Design) — a successful
 * POST /api/auth/login or POST /api/auth/signup body. */
export const authSuccessBody = {
  user: { id: TEST_USER_ID, handle: TEST_HANDLE, displayName: TEST_DISPLAY_NAME, avatarUrl: null },
  accessToken: TEST_ACCESS_TOKEN,
  refreshToken: TEST_REFRESH_TOKEN,
};

/** A 2xx body missing accessToken/refreshToken — integration scenario 8. */
export const authSuccessBodyMissingFields = {
  user: { id: TEST_USER_ID, handle: TEST_HANDLE, displayName: TEST_DISPLAY_NAME, avatarUrl: null },
};

/** 401 on sign-in — wrong credentials (integration scenario 3). */
export const wrongCredentialsBody = { error: "Incorrect handle or password" };

/** 409 on sign-up — handle already taken, with field detail (integration scenario 4). */
export const handleTakenBody = { error: "That handle is already taken", field: "handle" as const };

/** 409 on sign-up with NO field detail — per Data Design, field is read defensively;
 * absent means the message must land form-level, not be guessed onto a field. */
export const handleTakenBodyNoField = { error: "That handle is already taken" };

/** 422 on sign-up — weak password, with field detail (integration scenario 5). */
export const weakPasswordBody = { error: "Password is too weak", field: "password" as const };

/** 422 with a field name the client doesn't recognise — authMessages unit test per
 * tech-design.md's "including ... a body with an unknown field". */
export const unknownFieldBody = { error: "Something about this field", field: "avatarUrl" };

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

/** Builds a duck-typed Response for a given status/body pair. */
export function jsonResponse(status: number, body: unknown): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** A non-2xx response whose body cannot be parsed as JSON at all — integration
 * scenario 7 ("non-success with an unparseable body"). client.ts's existing
 * `.catch(() => ({}))` around res.json() is the code path this exercises. */
export function unparseableResponse(status: number): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    },
  };
}

/** A 204 No Content response, as rawFetch/apiFetch special-case it. */
export function noContentResponse(): FakeResponse {
  return {
    ok: true,
    status: 204,
    json: async () => {
      throw new Error("no body on 204");
    },
  };
}

/**
 * Installs a queued fetch mock on `global.fetch`. Each call consumes the next
 * queued entry in order; entries may be a response object or a thunk
 * returning a Promise (so a call can reject, or resolve later via
 * `deferred()` below). Throws loudly if the queue is exhausted, so a test
 * that fires more network calls than it expects fails immediately rather
 * than hanging.
 */
export function installFetchQueue(
  ...entries: Array<FakeResponse | (() => Promise<FakeResponse>)>
): jest.Mock {
  const queue = [...entries];
  const fetchMock = jest.fn(async (..._args: unknown[]) => {
    const next = queue.shift();
    if (!next) {
      throw new Error("installFetchQueue: fetch was called more times than fixtures were queued");
    }
    return typeof next === "function" ? next() : next;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetchMock;
  return fetchMock;
}

/** Installs a fetch mock whose every call rejects — integration scenario 6
 * ("backend unreachable"). Mirrors a real `fetch()` rejection (TypeError, per
 * both the DOM and React Native fetch implementations). */
export function installFetchReject(error: unknown = new TypeError("Network request failed")): jest.Mock {
  const fetchMock = jest.fn(async () => {
    throw error;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetchMock;
  return fetchMock;
}

/** An externally-resolvable promise, for tests that need to hold a request
 * "in flight" (e.g. the double-submission guard, integration scenario 10)
 * and control exactly when it resolves. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
