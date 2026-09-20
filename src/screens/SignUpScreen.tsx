import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "@/theme/colors";
import { useSession } from "@/session/SessionContext";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useSession();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp(handle.trim(), displayName.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create an account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>
        ReBanter<Text style={{ color: colors.accent }}>.</Text>
      </Text>
      <Text style={styles.subtitle}>Start your own crew</Text>

      <TextInput
        style={styles.input}
        placeholder="Handle (e.g. zoe.b)"
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        value={handle}
        onChangeText={setHandle}
      />
      <TextInput
        style={styles.input}
        placeholder="Display name"
        placeholderTextColor={colors.inkFaint}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 characters)"
        placeholderTextColor={colors.inkFaint}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primaryButton, isSubmitting && { opacity: 0.6 }]}
        onPress={onSubmit}
        disabled={isSubmitting || !handle || !displayName || password.length < 8}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.surfaceRaised} />
        ) : (
          <Text style={styles.primaryButtonText}>Create account</Text>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.navigate("SignIn")}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, padding: 24, justifyContent: "center", gap: 12 },
  brand: { fontSize: 34, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.inkMuted, marginBottom: 20 },
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
  primaryButton: {
    marginTop: 12,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.surfaceRaised, fontWeight: "700", fontSize: 15 },
  error: { color: colors.cheer, fontSize: 13 },
  link: { marginTop: 16, color: colors.accent, fontWeight: "600", textAlign: "center" },
});
