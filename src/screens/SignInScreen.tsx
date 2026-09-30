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
import { colors } from "@/theme/colors";
import { useSession } from "@/session/SessionContext";
import { validateSignIn } from "@/auth/authRules";
import { useAuthSubmit } from "@/auth/useAuthSubmit";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const { signIn } = useSession();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef<TextInput>(null);

  const validate = useCallback(() => validateSignIn({ handle, password }), [handle, password]);
  const run = useCallback(() => signIn(handle.trim(), password), [handle, password, signIn]);
  const { isSubmitting, fieldErrors, formError, submit } = useAuthSubmit(validate, run);

  // accessibilityLiveRegion is Android-only; iOS needs an explicit announcement
  // when the form-level error appears (tech-design.md Component Design §5).
  useEffect(() => {
    if (formError && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(formError);
    }
  }, [formError]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <Text style={styles.brand}>
            ReBanter<Text style={{ color: colors.accent }}>.</Text>
          </Text>
          <Text style={styles.subtitle}>Sign in to your crew</Text>

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
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          {fieldErrors.handle ? <Text style={styles.fieldError}>{fieldErrors.handle}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Min 8 characters"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Password"
            accessibilityHint={fieldErrors.password}
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
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
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.surfaceRaised} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign in</Text>
            )}
          </Pressable>

          <Pressable onPress={() => navigation.navigate("SignUp")} accessibilityRole="link">
            <Text style={styles.link}>New here? Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  container: { padding: 24, gap: 8, backgroundColor: colors.canvas },
  brand: { fontSize: 34, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.inkMuted, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkMuted, marginTop: 4 },
  input: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
  },
  fieldError: { color: colors.danger, fontSize: 13 },
  primaryButton: {
    marginTop: 12,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonBusy: { opacity: 0.6 },
  primaryButtonText: { color: colors.surfaceRaised, fontWeight: "700", fontSize: 15 },
  error: { color: colors.danger, fontSize: 13, backgroundColor: colors.cheerTint, borderRadius: 12, padding: 10 },
  link: { marginTop: 16, color: colors.accent, fontWeight: "600", textAlign: "center" },
});
