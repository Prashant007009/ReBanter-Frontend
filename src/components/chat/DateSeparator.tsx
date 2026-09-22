import { StyleSheet, Text, View } from "react-native";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";

function label(iso: string): string {
  const d = dayjs(iso);
  if (d.isSame(dayjs(), "day")) return "Today";
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return "Yesterday";
  if (d.isSame(dayjs(), "year")) return d.format("MMMM D");
  return d.format("MMMM D, YYYY");
}

export function DateSeparator({ createdAt }: { createdAt: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{label(createdAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", marginVertical: 14 },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkMuted,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: "hidden",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
