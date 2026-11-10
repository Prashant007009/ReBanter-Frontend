// issue #11 — unit tests for src/api/errors.ts (NEW, does not exist yet).
//
// Contract under test, pinned by tech-design.md Component Design §1
// (frozen) plus the interface this story's test suite requires:
//   - `ApiError extends Error`, carrying `status`, `statusClass`
//     ("network" | "client" | "server" | "malformed"), `body: unknown`,
//     `path: string`.
//   - `message` is built from "the same expression the code uses today":
//     `body.error ?? \`API ${path} failed: ${res.status}\`` for a response,
//     and the original rejection's message verbatim for a network failure.
//     This is the additive guarantee every existing apiFetch consumer
//     (nine call sites across src/api/*.ts) depends on.
//   - Two builder helpers, `apiErrorFromResponse` and
//     `apiErrorFromNetworkFailure`, used by src/api/client.ts. `statusClass`
//     "malformed" is reserved for SessionContext's own direct construction
//     (a 2xx body missing expected fields) and is not produced by either
//     builder here — see src/session/SessionContext.test.tsx.
//
// This file does not exist in the codebase yet (Phase 6 implements it), so
// every test below is expected to fail to even compile/run until then. That
// is the intended Red state for this phase.

import { ApiError, apiErrorFromResponse, apiErrorFromNetworkFailure } from "@/api/errors";

describe("ApiError", () => {
  it("extends Error and exposes status, statusClass, body and path", () => {
    const error = new ApiError({
      message: "Boom",
      status: 401,
      statusClass: "client",
      body: { error: "Boom" },
      path: "/api/auth/login",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Boom");
    expect(error.status).toBe(401);
    expect(error.statusClass).toBe("client");
    expect(error.body).toEqual({ error: "Boom" });
    expect(error.path).toBe("/api/auth/login");
  });

  it("supports statusClass 'malformed' for a body missing expected fields", () => {
    const error = new ApiError({
      message: "API /api/auth/login failed: 200",
      status: 200,
      statusClass: "malformed",
      body: { user: { id: "u1" } },
      path: "/api/auth/login",
    });

    expect(error.statusClass).toBe("malformed");
  });
});

describe("apiErrorFromResponse_clientStatus_classifiesAsClient", () => {
  it("classifies a 4xx response as statusClass 'client'", async () => {
    const res = { status: 401, json: async () => ({ error: "Incorrect handle or password" }) };
    const error = await apiErrorFromResponse("/api/auth/login", res);

    expect(error.statusClass).toBe("client");
    expect(error.status).toBe(401);
  });
});

describe("apiErrorFromResponse_serverStatus_classifiesAsServer", () => {
  it("classifies a 5xx response as statusClass 'server'", async () => {
    const res = { status: 503, json: async () => ({}) };
    const error = await apiErrorFromResponse("/api/auth/login", res);

    expect(error.statusClass).toBe("server");
    expect(error.status).toBe(503);
  });
});

describe("apiErrorFromResponse_bodyWithError_usesBodyErrorAsMessage", () => {
  it("uses body.error as the message when present — today's expression, unchanged", async () => {
    const res = { status: 409, json: async () => ({ error: "That handle is already taken" }) };
    const error = await apiErrorFromResponse("/api/auth/signup", res);

    expect(error.message).toBe("That handle is already taken");
  });
});

describe("apiErrorFromResponse_bodyWithoutError_fallsBackToStatusMessage", () => {
  it("falls back to `API {path} failed: {status}` when body has no error field", async () => {
    const res = { status: 500, json: async () => ({}) };
    const error = await apiErrorFromResponse("/api/users/me", res);

    expect(error.message).toBe("API /api/users/me failed: 500");
  });
});

describe("apiErrorFromResponse_unparseableBody_doesNotThrow", () => {
  it("falls back to the status message rather than throwing when json() rejects", async () => {
    const res = {
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    };

    await expect(apiErrorFromResponse("/api/auth/login", res)).resolves.toBeInstanceOf(ApiError);
    const error = await apiErrorFromResponse("/api/auth/login", res);
    expect(error.message).toBe("API /api/auth/login failed: 502");
  });

  it("preserves the body verbatim, including any field detail, for a parseable non-2xx body", async () => {
    const res = { status: 422, json: async () => ({ error: "Password is too weak", field: "password" }) };
    const error = await apiErrorFromResponse("/api/auth/signup", res);

    expect(error.body).toEqual({ error: "Password is too weak", field: "password" });
  });
});

describe("apiErrorFromNetworkFailure_rejectedFetch_classifiesAsNetwork", () => {
  it("classifies a rejected fetch as statusClass 'network' with status null", () => {
    const error = apiErrorFromNetworkFailure("/api/auth/login", new TypeError("Network request failed"));

    expect(error.statusClass).toBe("network");
    expect(error.status).toBeNull();
    expect(error.path).toBe("/api/auth/login");
  });

  it("carries the original rejection's message verbatim — additive guarantee", () => {
    const error = apiErrorFromNetworkFailure("/api/auth/login", new TypeError("Network request failed"));

    expect(error.message).toBe("Network request failed");
  });

  it("falls back to a generic message when the rejection was not an Error instance", () => {
    const error = apiErrorFromNetworkFailure("/api/auth/login", "not an Error object");

    expect(error.message.length).toBeGreaterThan(0);
    expect(error).toBeInstanceOf(Error);
  });
});
