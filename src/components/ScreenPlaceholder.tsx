import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme/colors";

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
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.onDark,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onDarkMuted,
    textAlign: "center",
  },
});
