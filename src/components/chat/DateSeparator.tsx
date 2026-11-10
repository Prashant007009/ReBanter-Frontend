import { StyleSheet, Text } from "react-native";
import dayjs from "@/lib/dayjs";
import { chat, fonts } from "@/theme/colors";

function label(iso: string): string {
  const d = dayjs(iso);
  const time = d.format("h:mm A");
  if (d.isSame(dayjs(), "day")) return `Today · ${time}`;
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return `Yesterday · ${time}`;
  if (d.isAfter(dayjs().subtract(6, "day"))) return `${d.format("ddd")} · ${time}`;
  if (d.isSame(dayjs(), "year")) return `${d.format("MMM D")} · ${time}`;
  return `${d.format("MMM D, YYYY")} · ${time}`;
}

/** Centered timestamp shown at the start of a thread and after a 30-minute lull. */
export function DateSeparator({ createdAt }: { createdAt: string }) {
  return <Text style={styles.text}>{label(createdAt)}</Text>;
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: chat.inkMuted, textAlign: "center", marginTop: 12, marginBottom: 10 },
});
