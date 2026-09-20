import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";

export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      style={[styles.track, { backgroundColor: value ? colors.accent : "#E6E0D6", justifyContent: value ? "flex-end" : "flex-start" }]}
    >
      <View style={styles.thumb} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 46, height: 27, borderRadius: 999, flexDirection: "row", alignItems: "center", padding: 3 },
  thumb: { width: 21, height: 21, borderRadius: 999, backgroundColor: colors.surfaceRaised },
});
