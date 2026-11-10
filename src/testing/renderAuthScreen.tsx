// issue #11 — shared render harness for the auth screen integration tests.
//
// Per tech-design.md's "Mocking strategy for Integration Points" (Phase 4,
// frozen): "A test renders the real screen inside the real SessionProvider,
// driving the real useAuthSubmit, the real SessionContext operations and the
// real tokenStore." This harness does exactly that and nothing else —
// SignInScreen and SignUpScreen are rendered inside a real
// @react-navigation NativeStack navigator (matching AuthStackParamList) and
// a real SessionProvider. The only two substitutions anywhere in this tree
// are expo-secure-store (jest.setup.ts) and, per-test, global.fetch (see
// authFixtures.ts).
//
// A note on the initial async bootstrap effect: SessionProvider's mount
// effect awaits getAccessToken() before resolving isLoading. Callers of
// renderAuthStack should `await waitFor(...)` on the isLoading probe once,
// before interacting with the screen, to avoid asserting mid-effect and to
// keep React's `act()` warnings quiet.

import React from "react";
import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { render, RenderResult } from "@testing-library/react-native";
import { SessionProvider, useSession } from "@/session/SessionContext";
import { SignInScreen } from "@/screens/SignInScreen";
import { SignUpScreen } from "@/screens/SignUpScreen";
import type { AuthStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const SESSION_PROBE_USER_TESTID = "session-probe-user";
export const SESSION_PROBE_LOADING_TESTID = "session-probe-loading";
export const SESSION_PROBE_NULL_USER_TEXT = "null";

/**
 * Exposes live session state as plain text nodes, as a sibling of the
 * AuthStack rather than something the screens themselves render — the
 * screens stay exactly as unaware of session internals as tech-design.md's
 * Cards-layer boundary requires ("No knowledge of @/api/* — the Cards layer
 * never sees the transport"). Tests read this probe, the screens don't.
 */
function SessionProbe() {
  const { user, isLoading } = useSession();
  return (
    <>
      <Text testID={SESSION_PROBE_USER_TESTID}>{user ? user.id : SESSION_PROBE_NULL_USER_TEXT}</Text>
      <Text testID={SESSION_PROBE_LOADING_TESTID}>{String(isLoading)}</Text>
    </>
  );
}

export function renderAuthStack(initialRouteName: keyof AuthStackParamList = "SignIn"): RenderResult {
  return render(
    <SessionProvider>
      <SessionProbe />
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SessionProvider>
  );
}
