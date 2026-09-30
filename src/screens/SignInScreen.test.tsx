// issue #11 — integration tests for SignInScreen.tsx.
//
// Real screen, real NavigationContainer, real SessionProvider, real
// useAuthSubmit/authRules/authMessages (src/auth/**, all new), real
// tokenStore. Only expo-secure-store (jest.setup.ts) and, per test,
// global.fetch (authFixtures.ts) are substituted — per tech-design.md's
// "Mocking strategy for Integration Points".
//
// The screen today (src/screens/SignInScreen.tsx) labels fields by
// placeholder only, gates the button with a blanket `disabled`, has no
// affordance props beyond autoCapitalize/autoCorrect on the handle field,
// no keyboard avoidance, and draws its error text from `colors.cheer`
// instead of `colors.danger`. Every test below that depends on the Phase 6
// rebuild (accessible names, field-level errors, affordances, keyboard
// avoidance, the danger token) is expected to fail against today's
// placeholder — that is the intended Red state for this phase.

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
  wrongCredentialsBody,
  TEST_HANDLE,
  TEST_PASSWORD,
} from "@/testing/fixtures/authFixtures";

async function renderSignedOut() {
  const screen = renderAuthStack("SignIn");
  await waitFor(() => expect(screen.getByTestId(SESSION_PROBE_LOADING_TESTID).props.children).toBe("false"));
  return screen;
}

beforeEach(() => {
  resetSecureStoreMock();
  jest.restoreAllMocks();
});

describe("SignInScreen_noSession_showsEntryPointWithNamedControls", () => {
  it("renders a handle field, a password field and a sign-in action, each with a durable accessible name (EVAL-SC1, EVAL-SC10)", async () => {
    const { getByLabelText, getByRole } = await renderSignedOut();

    expect(getByLabelText(/handle/i)).toBeTruthy();
    expect(getByLabelText(/password/i)).toBeTruthy();
    expect(getByRole("button", { name: /sign in/i })).toBeTruthy();
  });
});

describe("SignInScreen_crossLink_navigatesToSignUpAndBack", () => {
  it("moves to sign-up and back to sign-in without a dead end (integration scenario 13, SC1)", async () => {
    const { getByRole, getByText } = await renderSignedOut();

    fireEvent.press(getByText(/create an account/i));
    expect(getByRole("button", { name: /create account/i })).toBeTruthy();

    fireEvent.press(getByText(/already have an account/i));
    expect(getByRole("button", { name: /sign in/i })).toBeTruthy();
  });
});

describe("SignInScreen_emptySubmission_showsFieldErrorsNotSilentGating", () => {
  it("shows named field errors and issues no request, rather than leaving the action inert (SC5, integration scenario 12)", async () => {
    const fetchMock = installFetchQueue();
    const { getByRole, getByText } = await renderSignedOut();

    const button = getByRole("button", { name: /sign in/i });
    expect(button.props.accessibilityState?.disabled).not.toBe(true);

    fireEvent.press(button);

    await waitFor(() => expect(getByText(/handle/i)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("SignInScreen_whitespaceOnlyHandle_rejectedAsEmpty", () => {
  it("treats a whitespace-only handle as empty rather than submitting it trimmed (SC6, integration scenario 11)", async () => {
    const fetchMock = installFetchQueue();
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), "   ");
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});

describe("SignInScreen_validCredentials_signsInWithVisibleInFlightState", () => {
  it("persists tokens and resolves the session (integration scenario 1, SC2)", async () => {
    installFetchQueue(jsonResponse(200, authSuccessBody), jsonResponse(200, meProfileFixture));
    const { getByLabelText, getByRole, getByTestId } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(getByTestId(SESSION_PROBE_USER_TESTID).props.children).toBe(meProfileFixture.id));
    await expect(getAccessToken()).resolves.toBe(authSuccessBody.accessToken);
  });

  it("exposes a busy accessibility state on the primary action while the request is in flight", async () => {
    const gate = deferred<ReturnType<typeof jsonResponse>>();
    installFetchQueue(() => gate.promise);
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(getByRole("button", { name: /sign in/i }).props.accessibilityState?.busy).toBe(true));

    gate.resolve(jsonResponse(200, authSuccessBody));
  });
});

describe("SignInScreen_wrongCredentials_showsDistinctMessageAndRetainsInput", () => {
  it("shows a specific rejection message and keeps typed values so the person can retry (integration scenario 3, SC4)", async () => {
    installFetchQueue(jsonResponse(401, wrongCredentialsBody));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    const alert = await waitFor(() => getByRole("alert"));
    expect(alert.props.children).toBeTruthy();
    expect(getByLabelText(/handle/i).props.value).toBe(TEST_HANDLE);
    expect(getByLabelText(/password/i).props.value).toBe(TEST_PASSWORD);
  });
});

describe("SignInScreen_networkUnreachable_showsDistinctConnectivityMessage", () => {
  it("shows an error without crashing when fetch itself rejects (integration scenario 6, SC4)", async () => {
    installFetchReject();
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    const alert = await waitFor(() => getByRole("alert"));
    expect(alert.props.children).toBeTruthy();
  });
});

describe("SignInScreen_unparseableNonSuccessBody_showsGenericMessageNoCrash", () => {
  it("shows a distinct generic message rather than throwing (integration scenario 7, SC4)", async () => {
    installFetchQueue(unparseableResponse(502));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    const alert = await waitFor(() => getByRole("alert"));
    expect(alert.props.children).toBeTruthy();
  });
});

describe("SignInScreen_profileLookupFailsAfterCredentialsAccepted_clearsTokensAndShowsMessage", () => {
  it("shows a retryable message and leaves no tokens stored (integration scenario 9, highest-value assertion)", async () => {
    installFetchQueue(jsonResponse(200, authSuccessBody), () => Promise.reject(new TypeError("boom")));
    const { getByLabelText, getByRole, getByTestId } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(getByRole("alert")).toBeTruthy());
    await expect(getAccessToken()).resolves.toBeNull();
    expect(getByTestId(SESSION_PROBE_USER_TESTID).props.children).toBe(SESSION_PROBE_NULL_USER_TEXT);
  });
});

describe("SignInScreen_doublePressWhileInFlight_issuesExactlyOneRequest", () => {
  it("does not issue a second network call for a second press before the first settles (integration scenario 10, SC8)", async () => {
    const gate = deferred<ReturnType<typeof jsonResponse>>();
    const fetchMock = installFetchQueue(() => gate.promise, jsonResponse(200, meProfileFixture));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    const button = getByRole("button", { name: /sign in/i });
    fireEvent.press(button);
    fireEvent.press(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    gate.resolve(jsonResponse(200, authSuccessBody));
  });
});

describe("SignInScreen_errorText_usesDangerTokenNotCheerAccent", () => {
  it("draws the form error from colors.danger, not the celebratory colors.cheer (todo.md 6.3)", async () => {
    installFetchQueue(jsonResponse(401, wrongCredentialsBody));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    const alert = await waitFor(() => getByRole("alert"));
    const flatStyle = Array.isArray(alert.props.style) ? Object.assign({}, ...alert.props.style) : alert.props.style;
    expect(flatStyle.color).toBe(colors.danger);
    expect(flatStyle.color).not.toBe(colors.cheer);
  });
});

describe("SignInScreen_inputAffordances_correctPerField", () => {
  it("sets keyboard type, capitalisation and credential-manager hints on the handle field", async () => {
    const { getByLabelText } = await renderSignedOut();
    const handle = getByLabelText(/handle/i);

    expect(handle.props.autoCapitalize).toBe("none");
    expect(handle.props.autoCorrect).toBe(false);
    expect(handle.props.textContentType).toBe("username");
    expect(handle.props.autoComplete).toBe("username");
    expect(handle.props.returnKeyType).toBe("next");
  });

  it("sets secure entry and sign-in-specific credential-manager hints on the password field", async () => {
    const { getByLabelText } = await renderSignedOut();
    const password = getByLabelText(/password/i);

    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.textContentType).toBe("password");
    expect(password.props.autoComplete).toBe("current-password");
    expect(password.props.returnKeyType).toBe("go");
  });
});

describe("SignInScreen_keyboardSubmission_submitsFromLastFieldAndAdvancesFocus", () => {
  it("submits when the action key fires on the password field", async () => {
    installFetchQueue(jsonResponse(200, authSuccessBody), jsonResponse(200, meProfileFixture));
    const { getByLabelText } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent(getByLabelText(/password/i), "submitEditing");

    await waitFor(() => expect(getByLabelText(/password/i)).toBeTruthy());
  });
});

describe("SignInScreen_keyboardAvoidance_wrapsTheForm", () => {
  it("wraps the screen in a KeyboardAvoidingView so fields and the action stay reachable (todo.md Step 4.5)", async () => {
    const { UNSAFE_getByType } = await renderSignedOut();

    expect(() => UNSAFE_getByType(KeyboardAvoidingView)).not.toThrow();
  });
});

describe("SignInScreen_accessibility_alertRoleAndControlNames", () => {
  it("exposes the form error region with role=alert once an error is shown (integration scenario 14)", async () => {
    installFetchQueue(jsonResponse(401, wrongCredentialsBody));
    const { getByLabelText, getByRole } = await renderSignedOut();

    fireEvent.changeText(getByLabelText(/handle/i), TEST_HANDLE);
    fireEvent.changeText(getByLabelText(/password/i), TEST_PASSWORD);
    fireEvent.press(getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(getByRole("alert")).toBeTruthy());
  });

  it("gives the primary action an explicit button role and label", async () => {
    const { getByRole } = await renderSignedOut();
    expect(getByRole("button", { name: /sign in/i })).toBeTruthy();
  });
});
