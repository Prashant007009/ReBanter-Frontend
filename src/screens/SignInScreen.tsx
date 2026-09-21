import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { ScreenGradient } from "@/components/ScreenGradient";
import { useSession } from "@/session/SessionContext";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const { signIn } = useSession();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(handle.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenGradient style={styles.container}>
      <Text style={styles.brand}>
        ReBanter<Text style={{ color: colors.accent }}>.</Text>
      </Text>
      <Text style={styles.subtitle}>Sign in to your crew</Text>

      <TextInput
        style={styles.input}
        placeholder="Handle"
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        value={handle}
        onChangeText={setHandle}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.inkFaint}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primaryButton, isSubmitting && { opacity: 0.6 }]}
        onPress={onSubmit}
        disabled={isSubmitting || !handle || !password}
      >
        {isSubmitting ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.navigate("SignUp")}>
        <Text style={styles.link}>New here? Create an account</Text>
      </Pressable>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
  brand: { fontFamily: fonts.display, fontSize: 34, color: colors.onDark, marginBottom: 4 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.onDarkMuted, marginBottom: 20 },
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
  primaryButton: {
    marginTop: 12,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 15 },
  error: { fontFamily: fonts.bodyMedium, color: colors.cheer, fontSize: 13 },
  link: { fontFamily: fonts.bodySemibold, marginTop: 16, color: colors.accent, textAlign: "center" },
});
