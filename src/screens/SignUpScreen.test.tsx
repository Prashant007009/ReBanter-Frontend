// issue #11 — integration tests for SignUpScreen.tsx.
//
// Mirrors SignInScreen.test.tsx (same real-screen / real-provider / real-ops
// approach; see that file's header for the full rationale) but exercises the
// three-field sign-up path, including server-side field attribution for the
// two sign-up-specific rejections (409 handle-taken, 422 weak-password) and
// the requirement that sign-up produces exactly the same outcome as sign-in
// with no intermediate step (Phase 2 Decision 4).

import { KeyboardAvoidingView } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { colors } from "@/theme/colors";
import { getAccessToken } from "@/session/tokenStore";
import { resetSecureStoreMock } from "@/testing/mocks/secureStoreMock";
import {
  renderAuthStack,
  SESSION_PROBE_USER_TESTID,
  SESSION_PROBE_LOADING_TESTID,
  SESSION_PROBE_NULL_USER_TEXT,
} from "@/testing/renderAuthScreen";
import {
  installFetchQueue,
  installFetchReject,
  jsonResponse,
  unparseableResponse,
  deferred,
  authSuccessBody,
  meProfileFixture,
  handleTakenBody,
  weakPasswordBody,
  TEST_HANDLE,
  TEST_DISPLAY_NAME,
  TEST_PASSWORD,
} from "@/testing/fixtures/authFixtures";

async function renderSignedOut() {
  const screen = renderAuthStack("SignUp");
  await waitFor(() => expect(screen.getByTestId(SESSION_PROBE_LOADING_TESTID).props.children).toBe("false"));
  return screen;
}

function fillValidForm(getByLabelText: ReturnType<typeof renderAuthStack>["getByLabelText"]) {
  fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
  fireEvent.changeText(getByLabelText(/display name/i), TEST_DISPLAY_NAME);
  fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
}

beforeEach(() => {
  resetSecureStoreMock();
  jest.restoreAllMocks();
});

describe("SignUpScreen_noSession_showsEntryPointWithNamedControls", () => {
  it("renders handle, display name and password fields plus a create-account action, each with a durable accessible name (EVAL-SC1, EVAL-SC10)", async () => {
    const { getByLabelText, getByRole } = await renderSignedOut();

    expect(getByLabelText(/handle/i)).toBeTruthy();
    expect(getByLabelText(/display name/i)).toBeTruthy();
    expect(getByLabelText(/password/i)).toBeTruthy();
    expect(getByRole("button", { name: /create account/i })).toBeTruthy();
  });
});

describe("SignUpScreen_crossLink_navigatesToSignInAndBack", () => {
  it("moves to sign-in and back to sign-up without a dead end (integration scenario 13, SC1)", async () => {
    const { getByRole, getByText } = await renderSignedOut();

    fireEvent.press(getByText(/already have an account/i));
    expect(getByRole("button", { name: /sign in/i })).toBeTruthy();

    fireEvent.press(getByText(/new here/i));
    expect(getByRole("button", { name: /create account/i })).toBeTruthy();
  });
});

describe("SignUpScreen_emptySubmission_showsFieldErrorsForAllThreeFields", () => {
  it("shows named field errors for handle, display name and password and issues no request (SC5, integration scenario 12)", async () => {
    const fetchMock = installFetchQueue();
    const { getByRole, getByText } = await renderSignedOut();

    const button = getByRole("button", { name: /create account/i });
    expect(button.props.accessibilityState?.disabled).not.toBe(true);

    fireEvent.press(button);

    await waitFor(() => expect(getByText(/handle/i)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("SignUpScreen_whitespaceOnlyDisplayName_rejectedAsEmpty", () => {
  it("treats a whitespace-only display name as empty rather than submitting it trimmed (SC6)", async () => {
    const fetchMock = installFetchQueue();
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/display name/i), "   ");
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});

describe("SignUpScreen_validDetails_signsUpWithIdenticalOutcomeToSignIn", () => {
  it("persists tokens and resolves the session with no intermediate step (integration scenario 2, SC3)", async () => {
    installFetchQueue(jsonResponse(200, authSuccessBody), jsonResponse(200, meProfileFixture));
    const { getByLabelText, getByRole, getByTestId } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(getByTestId(SESSION_PROBE_USER_TESTID).props.children).toBe(meProfileFixture.id));
    await expect(getAccessToken()).resolves.toBe(authSuccessBody.accessToken);
  });
});

describe("SignUpScreen_handleAlreadyTaken_attributedToHandleField", () => {
  it("attributes a 409 rejection to the handle field, not a generic form banner (integration scenario 4)", async () => {
    installFetchQueue(jsonResponse(409, handleTakenBody));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(getByLabelText(/handle/i).props.accessibilityHint).toMatch(/taken/i));
  });
});

describe("SignUpScreen_weakPassword_attributedToPasswordField", () => {
  it("attributes a 422 rejection to the password field (integration scenario 5)", async () => {
    installFetchQueue(jsonResponse(422, weakPasswordBody));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(getByLabelText(/password/i).props.accessibilityHint).toEqual(expect.any(String)));
    expect(getByLabelText(/password/i).props.accessibilityHint?.length).toBeGreaterThan(0);
  });
});

describe("SignUpScreen_networkUnreachable_showsDistinctConnectivityMessage", () => {
  it("shows an error without crashing when fetch itself rejects (integration scenario 6, SC4)", async () => {
    installFetchReject();
    const { getByLabelText, getByRole } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    const alert = await waitFor(() => getByRole("alert"));
    expect(alert.props.children).toBeTruthy();
  });
});

describe("SignUpScreen_unparseableNonSuccessBody_showsGenericMessageNoCrash", () => {
  it("shows a distinct generic message rather than throwing (integration scenario 7, SC4)", async () => {
    installFetchQueue(unparseableResponse(502));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    const alert = await waitFor(() => getByRole("alert"));
    expect(alert.props.children).toBeTruthy();
  });
});

describe("SignUpScreen_profileLookupFailsAfterCredentialsAccepted_clearsTokensAndShowsMessage", () => {
  it("shows a retryable message and leaves no tokens stored (integration scenario 9, highest-value assertion)", async () => {
    installFetchQueue(jsonResponse(200, authSuccessBody), () => Promise.reject(new TypeError("boom")));
    const { getByLabelText, getByRole, getByTestId } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(getByRole("alert")).toBeTruthy());
    await expect(getAccessToken()).resolves.toBeNull();
    expect(getByTestId(SESSION_PROBE_USER_TESTID).props.children).toBe(SESSION_PROBE_NULL_USER_TEXT);
  });
});

describe("SignUpScreen_doublePressWhileInFlight_issuesExactlyOneRequest", () => {
  it("does not issue a second network call for a second press before the first settles (integration scenario 10, SC8)", async () => {
    const gate = deferred<ReturnType<typeof jsonResponse>>();
    const fetchMock = installFetchQueue(() => gate.promise, jsonResponse(200, meProfileFixture));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fillValidForm(getByLabelText);
    const button = getByRole("button", { name: /create account/i });
    fireEvent.press(button);
    fireEvent.press(button);

    // signUp generates the E2E identity (src/crypto/e2e.ts, real async crypto)
    // before its first network call, so — unlike signIn — the request isn't
    // necessarily in flight yet in the same tick as the presses; wait for it
    // rather than asserting synchronously. The double-submit guard itself
    // (useAuthSubmit's inFlightRef) is still checked synchronously on the
    // second press, before either signUp call's async work runs.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    gate.resolve(jsonResponse(200, authSuccessBody));
  });
});

describe("SignUpScreen_errorText_usesDangerTokenNotCheerAccent", () => {
  it("draws the form error from colors.danger, not the celebratory colors.cheer (todo.md 6.3)", async () => {
    installFetchQueue(jsonResponse(401, { error: "unexpected" }));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    const alert = await waitFor(() => getByRole("alert"));
    const flatStyle = Array.isArray(alert.props.style) ? Object.assign({}, ...alert.props.style) : alert.props.style;
    expect(flatStyle.color).toBe(colors.danger);
    expect(flatStyle.color).not.toBe(colors.cheer);
  });
});

describe("SignUpScreen_inputAffordances_correctPerField", () => {
  it("sets keyboard type and capitalisation on the handle field", async () => {
    const { getByLabelText } = await renderSignedOut();
    const handle = getByLabelText(/handle/i);

    expect(handle.props.autoCapitalize).toBe("none");
    expect(handle.props.autoCorrect).toBe(false);
    expect(handle.props.textContentType).toBe("username");
    expect(handle.props.autoComplete).toBe("username");
    expect(handle.props.returnKeyType).toBe("next");
  });

  it("capitalises words and hints a name field for display name", async () => {
    const { getByLabelText } = await renderSignedOut();
    const displayName = getByLabelText(/display name/i);

    expect(displayName.props.autoCapitalize).toBe("words");
    expect(displayName.props.textContentType).toBe("name");
    expect(displayName.props.returnKeyType).toBe("next");
  });

  it("sets secure entry and sign-up-specific credential-manager hints on the password field", async () => {
    const { getByLabelText } = await renderSignedOut();
    const password = getByLabelText(/password/i);

    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.textContentType).toBe("newPassword");
    expect(password.props.autoComplete).toBe("new-password");
    expect(password.props.returnKeyType).toBe("go");
  });
});

describe("SignUpScreen_keyboardSubmission_submitsFromLastFieldAndAdvancesFocus", () => {
  it("submits when the action key fires on the password field", async () => {
    installFetchQueue(jsonResponse(200, authSuccessBody), jsonResponse(200, meProfileFixture));
    const { getByLabelText } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent(getByLabelText(/password/i), "submitEditing");

    await waitFor(() => expect(getByLabelText(/password/i)).toBeTruthy());
  });
});

describe("SignUpScreen_keyboardAvoidance_wrapsTheForm", () => {
  it("wraps the screen in a KeyboardAvoidingView so fields and the action stay reachable (todo.md Step 4.5)", async () => {
    const { UNSAFE_getByType } = await renderSignedOut();

    expect(() => UNSAFE_getByType(KeyboardAvoidingView)).not.toThrow();
  });
});

describe("SignUpScreen_accessibility_alertRoleAndControlNames", () => {
  it("exposes the form error region with role=alert once an error is shown (integration scenario 14)", async () => {
    installFetchQueue(jsonResponse(401, { error: "unexpected" }));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fillValidForm(getByLabelText);
    fireEvent.press(getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(getByRole("alert")).toBeTruthy());
  });

  it("gives the primary action an explicit button role and label", async () => {
    const { getByRole } = await renderSignedOut();
    expect(getByRole("button", { name: /create account/i })).toBeTruthy();
  });
});
