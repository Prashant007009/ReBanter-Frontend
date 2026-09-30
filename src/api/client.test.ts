// issue #11 — integration tests for src/api/client.ts's failure classification
// (Step 1 of tech-design.md's Implementation Strategy).
//
// client.ts today throws plain `Error` on both the non-ok-response path and
// the rejected-fetch path. Phase 6 must make it throw `ApiError` (src/api/errors.ts,
// which does not exist yet) instead, additively: every existing apiFetch
// consumer (nine call sites — src/api/{banters,crew,drops,media,pulse,rooms,
// search,users}.ts and src/screens/NewDropScreen.tsx) reads only
// `err instanceof Error` and `err.message`, so all of them must keep observing
// exactly what they observe today. That additive guarantee is what
// "existingCaller_unaffected" below exists to prove — per tech-design.md
// Phase 1 gate: "a regression test proves an existing non-auth caller still
// sees the same err.message."
//
// The 401-refresh-and-retry path, the refresh in-flight latch and the 204
// handling are all explicitly "untouched" per tech-design.md Component
// Design §2 — the tests here treat that behaviour as a baseline that must
// keep passing, not as new Red coverage.

import { apiFetch, rawFetch } from "@/api/client";
import { ApiError } from "@/api/errors";
import { setTokens, getAccessToken } from "@/session/tokenStore";
import { resetSecureStoreMock } from "@/testing/mocks/secureStoreMock";
import { installFetchQueue, installFetchReject, jsonResponse, noContentResponse } from "@/testing/fixtures/authFixtures";

beforeEach(() => {
  resetSecureStoreMock();
  jest.restoreAllMocks();
});

describe("rawFetch_nonOkResponse_throwsClassifiedApiError", () => {
  it("throws an ApiError with statusClass 'client' and the parsed body for a 4xx", async () => {
    installFetchQueue(jsonResponse(401, { error: "Incorrect handle or password" }));

    await expect(rawFetch("/api/auth/login", { method: "POST" })).rejects.toBeInstanceOf(ApiError);

    installFetchQueue(jsonResponse(401, { error: "Incorrect handle or password" }));
    try {
      await rawFetch("/api/auth/login", { method: "POST" });
      throw new Error("expected rawFetch to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.statusClass).toBe("client");
      expect(apiErr.status).toBe(401);
      expect(apiErr.body).toEqual({ error: "Incorrect handle or password" });
    }
  });

  it("throws an ApiError with statusClass 'server' for a 5xx", async () => {
    installFetchQueue(jsonResponse(503, {}));

    try {
      await rawFetch("/api/auth/login", { method: "POST" });
      throw new Error("expected rawFetch to reject");
    } catch (err) {
      expect((err as ApiError).statusClass).toBe("server");
    }
  });
});

describe("rawFetch_rejectedFetch_throwsNetworkClassifiedApiError", () => {
  it("throws an ApiError with statusClass 'network' rather than collapsing to a generic error", async () => {
    installFetchReject(new TypeError("Network request failed"));

    try {
      await rawFetch("/api/auth/login", { method: "POST" });
      throw new Error("expected rawFetch to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusClass).toBe("network");
      expect((err as ApiError).status).toBeNull();
    }
  });
});

describe("rawFetch_success204_returnsUndefined", () => {
  it("still returns undefined for a 204, unchanged", async () => {
    installFetchQueue(noContentResponse());

    await expect(rawFetch("/api/auth/refresh", { method: "POST" })).resolves.toBeUndefined();
  });
});

describe("client_existingCaller_unaffected", () => {
  it("still observes err instanceof Error with today's exact message for a body with an error field", async () => {
    installFetchQueue(jsonResponse(409, { error: "That handle is already taken" }));

    try {
      await rawFetch("/api/auth/signup", { method: "POST" });
      throw new Error("expected rawFetch to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("That handle is already taken");
    }
  });

  it("still observes today's exact fallback message when the body has no error field", async () => {
    installFetchQueue(jsonResponse(500, {}));

    try {
      await apiFetch("/api/drops");
      throw new Error("expected apiFetch to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("API /api/drops failed: 500");
    }
  });

  it("still observes a rejected fetch's original message verbatim through a non-auth caller", async () => {
    installFetchReject(new TypeError("Network request failed"));

    try {
      await apiFetch("/api/drops");
      throw new Error("expected apiFetch to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("Network request failed");
    }
  });
});

describe("apiFetch_401WithStoredToken_refreshesAndRetriesUnchanged", () => {
  it("attaches the stored access token, retries once on 401 via refresh, and returns the retried result", async () => {
    await setTokens("stale-access-token", "a-refresh-token");

    // 1st call: the original request, 401s. 2nd call: the refresh call, succeeds.
    // 3rd call: the retried original request, succeeds.
    installFetchQueue(
      jsonResponse(401, { error: "Session expired" }),
      jsonResponse(200, { accessToken: "fresh-access-token", refreshToken: "fresh-refresh-token" }),
      jsonResponse(200, { items: [] })
    );

    const result = await apiFetch<{ items: unknown[] }>("/api/drops");

    expect(result).toEqual({ items: [] });
    await expect(getAccessToken()).resolves.toBe("fresh-access-token");
  });
});
