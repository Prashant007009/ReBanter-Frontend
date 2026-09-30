// issue #11 — integration tests for src/session/SessionContext.tsx's atomic
// sign-in / sign-up transition (Step 2 of tech-design.md's Implementation
// Strategy).
//
// This is the narrow, pre-approved exception to "infrastructure is consumed,
// not modified" (spec.md Constraints): signIn/signUp must become all-or-nothing.
// Today, a failure in loadMe() after setTokens() leaves tokens stored, no
// user resolved, and the person stranded on the entry screen. Test
// "atomicSignIn_profileLookupFailsAfterTokensPersisted" below is, per
// tech-design.md Testing Strategy, "the highest-value assertion in this story."
//
// Real SessionProvider, real tokenStore (against the in-memory
// expo-secure-store substitute installed by jest.setup.ts), only the network
// boundary substituted per-test via authFixtures. No SessionContext internals
// are mocked.

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { SessionProvider, useSession } from "@/session/SessionContext";
import { getAccessToken, getRefreshToken, setTokens } from "@/session/tokenStore";
import { resetSecureStoreMock } from "@/testing/mocks/secureStoreMock";
import {
  installFetchQueue,
  jsonResponse,
  authSuccessBody,
  authSuccessBodyMissingFields,
  meProfileFixture,
  TEST_HANDLE,
  TEST_DISPLAY_NAME,
  TEST_PASSWORD,
} from "@/testing/fixtures/authFixtures";

function renderSession() {
  return renderHook(() => useSession(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <SessionProvider>{children}</SessionProvider>,
  });
}

beforeEach(() => {
  resetSecureStoreMock();
  jest.restoreAllMocks();
});

describe("signIn_validCredentials_persistsTokensAndResolvesUser", () => {
  it("stores the returned tokens and resolves the user profile (integration scenario 1)", async () => {
    installFetchQueue(jsonResponse(200, authSuccessBody), jsonResponse(200, meProfileFixture));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signIn(TEST_HANDLE, TEST_PASSWORD);
    });

    await expect(getAccessToken()).resolves.toBe(authSuccessBody.accessToken);
    expect(result.current.user?.id).toBe(meProfileFixture.id);
  });
});

describe("signUp_validDetails_producesIdenticalOutcomeToSignIn", () => {
  it("stores tokens and resolves the user in one step, no intermediate state (integration scenario 2)", async () => {
    installFetchQueue(jsonResponse(200, authSuccessBody), jsonResponse(200, meProfileFixture));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signUp(TEST_HANDLE, TEST_DISPLAY_NAME, TEST_PASSWORD);
    });

    await expect(getAccessToken()).resolves.toBe(authSuccessBody.accessToken);
    expect(result.current.user?.id).toBe(meProfileFixture.id);
  });
});

describe("signIn_successBodyMissingTokens_rejectedBeforeStorage", () => {
  it("throws before setTokens when the 2xx body is missing accessToken/refreshToken (integration scenario 8)", async () => {
    const fetchMock = installFetchQueue(jsonResponse(200, authSuccessBodyMissingFields));
    const { result } = renderSession();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn(TEST_HANDLE, TEST_PASSWORD);
      })
    ).rejects.toBeDefined();

    await expect(getAccessToken()).resolves.toBeNull();
    // Only the login call should have happened — no loadMe() attempted with garbage tokens.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("atomicSignIn_profileLookupFailsAfterTokensPersisted", () => {
  it("clears stored tokens and surfaces a retryable error when loadMe fails right after sign-in (integration scenario 9 — highest-value assertion)", async () => {
    installFetchQueue(
      jsonResponse(200, authSuccessBody),
      () => Promise.reject(new TypeError("Network request failed"))
    );
    const { result } = renderSession();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn(TEST_HANDLE, TEST_PASSWORD);
      })
    ).rejects.toBeDefined();

    await expect(getAccessToken()).resolves.toBeNull();
    await expect(getRefreshToken()).resolves.toBeNull();
    expect(result.current.user).toBeNull();
  });
});

describe("atomicSignUp_profileLookupFailsAfterTokensPersisted", () => {
  it("clears stored tokens and surfaces a retryable error when loadMe fails right after sign-up", async () => {
    installFetchQueue(
      jsonResponse(200, authSuccessBody),
      () => Promise.reject(new TypeError("Network request failed"))
    );
    const { result } = renderSession();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signUp(TEST_HANDLE, TEST_DISPLAY_NAME, TEST_PASSWORD);
      })
    ).rejects.toBeDefined();

    await expect(getAccessToken()).resolves.toBeNull();
    await expect(getRefreshToken()).resolves.toBeNull();
    expect(result.current.user).toBeNull();
  });
});

describe("restartAfterFailure_nothingRetained_landsOnUnauthenticatedStack", () => {
  it("a fresh mount after a cleared rollback resolves no user and issues no profile call (SC7 / todo 2.3)", async () => {
    // First mount: induce the rollback from a failed profile lookup.
    installFetchQueue(jsonResponse(200, authSuccessBody), () => Promise.reject(new TypeError("boom")));
    const first = renderSession();
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    // The rejection assertion is made *inside* the act() callback (rather than
    // wrapping act()'s own return value in `expect(...).rejects`) so that
    // act() only settles once the full signIn rollback chain — setTokens,
    // the failed loadMe, and clearTokens — has actually completed. Wrapping
    // act()'s custom thenable in `expect().rejects` lets this act() call
    // settle before that inner chain finishes, which used to let the "second
    // mount" below race the still-in-flight rollback and read a token that
    // hadn't been cleared yet.
    await act(async () => {
      await expect(first.result.current.signIn(TEST_HANDLE, TEST_PASSWORD)).rejects.toBeDefined();
    });
    await expect(getAccessToken()).resolves.toBeNull();

    // "Restart": a brand new SessionProvider mount, as app start would produce.
    const fetchMock = installFetchQueue();
    const second = renderSession();
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));

    expect(second.result.current.user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("appStart_staleInvalidToken_doesNotHangAndLandsUnauthenticated", () => {
  it("a stored-but-stale token that fails to resolve a profile leaves the app signed out (spec.md Data/Scenario Considerations)", async () => {
    await setTokens("stale-access-token", "stale-refresh-token");
    // 1st call: GET /api/users/me with the stale token -> 401.
    // 2nd call: the resulting refresh attempt -> also fails.
    installFetchQueue(jsonResponse(401, { error: "Session expired" }), () => Promise.reject(new TypeError("boom")));

    const { result } = renderSession();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });
});
