// issue #11 — unit tests for src/auth/useAuthSubmit.ts (NEW, does not exist yet).
//
// tech-design.md Component Design §4 describes the lifecycle in prose: "run
// rules → short-circuit with field errors if invalid → set in-flight → call
// the session operation → on rejection, translate and place the message
// (form-level or field-level) → clear in-flight. The double-submit guard is
// a useRef latch checked synchronously at the top of the handler, not the
// isSubmitting state — state has not flushed when a second press lands in
// the same tick." It does not pin a literal function signature; this test
// file is that pinning, deliberately kept minimal so it composes for both
// screens (sign-in: 2 fields; sign-up: 3):
//
//   useAuthSubmit(validate: () => FieldErrors, run: () => Promise<void>): {
//     isSubmitting: boolean;
//     fieldErrors: FieldErrors;
//     formError: string | null;
//     submit: () => void;
//   }
//
// `run` is a caller-supplied thunk (the screen closes over signIn/signUp and
// the current field values); `validate` likewise closes over authRules and
// the current fields. This keeps useAuthSubmit itself free of any
// `@/api/*` or `@/session/*` import, matching "screens stay unaware of the
// transport" while still being screen-agnostic.
//
// These are hook-level tests with a synchronous fake `run`, complementing
// (not duplicating) the end-to-end double-press coverage against the real
// session ops and real fetch boundary in SignInScreen.test.tsx / SignUpScreen.test.tsx.

import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAuthSubmit } from "@/auth/useAuthSubmit";
import { ApiError } from "@/api/errors";
import { deferred } from "@/testing/fixtures/authFixtures";

describe("useAuthSubmit_invalidFields_shortCircuitsBeforeRun", () => {
  it("populates fieldErrors and never calls run() when validate() returns errors", () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const validate = jest.fn().mockReturnValue({ handle: "Handle is required." });

    const { result } = renderHook(() => useAuthSubmit(validate, run));

    act(() => {
      result.current.submit();
    });

    expect(run).not.toHaveBeenCalled();
    expect(result.current.fieldErrors).toEqual({ handle: "Handle is required." });
    expect(result.current.isSubmitting).toBe(false);
  });
});

describe("useAuthSubmit_validFieldsAndSuccess_runsAndClearsState", () => {
  it("calls run() once, toggles isSubmitting, and clears errors on success", async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const validate = jest.fn().mockReturnValue({});

    const { result } = renderHook(() => useAuthSubmit(validate, run));

    act(() => {
      result.current.submit();
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.formError).toBeNull();
  });
});

describe("useAuthSubmit_runRejectsWithApiError_setsFormError", () => {
  it("translates a rejected run() into formError and resets isSubmitting", async () => {
    const apiError = new ApiError({ message: "x", status: 401, statusClass: "client", body: { error: "bad creds" }, path: "/api/auth/login" });
    const run = jest.fn().mockRejectedValue(apiError);
    const validate = jest.fn().mockReturnValue({});

    const { result } = renderHook(() => useAuthSubmit(validate, run));

    act(() => {
      result.current.submit();
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(result.current.formError).toEqual(expect.any(String));
    expect(result.current.formError?.length).toBeGreaterThan(0);
  });

  it("attributes a field-scoped rejection to fieldErrors rather than formError", async () => {
    const apiError = new ApiError({
      message: "x",
      status: 409,
      statusClass: "client",
      body: { error: "taken", field: "handle" },
      path: "/api/auth/signup",
    });
    const run = jest.fn().mockRejectedValue(apiError);
    const validate = jest.fn().mockReturnValue({});

    const { result } = renderHook(() => useAuthSubmit(validate, run));

    act(() => {
      result.current.submit();
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(result.current.fieldErrors.handle).toEqual(expect.any(String));
  });
});

describe("useAuthSubmit_doublePressWhileInFlight_runsExactlyOnce", () => {
  it("ignores a second submit() call while the first is still in flight (integration scenario 10, hook level)", async () => {
    const gate = deferred<void>();
    const run = jest.fn().mockReturnValue(gate.promise);
    const validate = jest.fn().mockReturnValue({});

    const { result } = renderHook(() => useAuthSubmit(validate, run));

    act(() => {
      result.current.submit();
      result.current.submit();
    });

    expect(run).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
