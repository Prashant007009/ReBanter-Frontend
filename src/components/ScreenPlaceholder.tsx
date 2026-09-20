import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

/**
 * Temporary stand-in used until a screen's story is implemented.
 * Each usage should be replaced when its tracked issue is picked up.
 */
export function ScreenPlaceholder({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    color: colors.ink,
    fontWeight: "700",
  },
  note: {
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
