import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { ScreenGradient } from "@/components/ScreenGradient";
import { useSession } from "@/session/SessionContext";
import { validateSignUp } from "@/auth/authRules";
import { useAuthSubmit } from "@/auth/useAuthSubmit";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useSession();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const displayNameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const validate = useCallback(() => validateSignUp({ handle, displayName, password }), [handle, displayName, password]);
  const run = useCallback(
    () => signUp(handle.trim(), displayName.trim(), password),
    [handle, displayName, password, signUp]
  );
  const { isSubmitting, fieldErrors, formError, submit } = useAuthSubmit(validate, run);

  // accessibilityLiveRegion is Android-only; iOS needs an explicit announcement
  // when the form-level error appears (tech-design.md Component Design §5).
  useEffect(() => {
    if (formError && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(formError);
    }
  }, [formError]);

  return (
    <ScreenGradient style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <Text style={styles.brand}>
              ReBanter<Text style={{ color: colors.accent }}>.</Text>
            </Text>
            <Text style={styles.subtitle}>Start your own crew</Text>

            <Text style={styles.label}>Handle</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. zoe.b"
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel="Handle"
              accessibilityHint={fieldErrors.handle}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
              blurOnSubmit={false}
              value={handle}
              onChangeText={setHandle}
              onSubmitEditing={() => displayNameRef.current?.focus()}
            />
            {fieldErrors.handle ? <Text style={styles.fieldError}>{fieldErrors.handle}</Text> : null}

            <Text style={styles.label}>Display name</Text>
            <TextInput
              ref={displayNameRef}
              style={styles.input}
              placeholder="e.g. Zoe B"
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel="Display name"
              accessibilityHint={fieldErrors.displayName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
              blurOnSubmit={false}
              value={displayName}
              onChangeText={setDisplayName}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            {fieldErrors.displayName ? <Text style={styles.fieldError}>{fieldErrors.displayName}</Text> : null}

            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Min 8 characters"
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel="Password"
              accessibilityHint={fieldErrors.password}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
            />
            {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

            {formError ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                {formError}
              </Text>
            ) : null}

            <Pressable
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonBusy]}
              onPress={submit}
              accessibilityRole="button"
              accessibilityLabel="Create account"
              accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </Pressable>

            <Pressable onPress={() => navigation.navigate("SignIn")} accessibilityRole="link">
              <Text style={styles.link}>Already have an account? Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  container: { padding: 24, gap: 8 },
  brand: { fontFamily: fonts.display, fontSize: 34, color: colors.onDark, marginBottom: 4 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.onDarkMuted, marginBottom: 20 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.onDarkMuted, marginTop: 4 },
  input: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  fieldError: { fontFamily: fonts.bodyMedium, color: colors.danger, fontSize: 13 },
  primaryButton: {
    marginTop: 12,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonBusy: { opacity: 0.6 },
  primaryButtonText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 15 },
  error: {
    fontFamily: fonts.bodyMedium,
    color: colors.danger,
    fontSize: 13,
    backgroundColor: colors.cheerTint,
    borderRadius: 12,
    padding: 10,
  },
  link: { fontFamily: fonts.bodySemibold, marginTop: 16, color: colors.accent, textAlign: "center" },
});
