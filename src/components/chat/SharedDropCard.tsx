import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { chat, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { getDrop } from "@/api/drops";
import { takeTheme } from "@/components/stream/format";
import type { StreamDrop } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const cache = new Map<string, StreamDrop | "gone">();

/** A drop shared from Stream into a Banter: author, cover and caption; tap for the author's profile. */
export function SharedDropCard({ dropId, note }: { dropId: string; note?: string | null }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [drop, setDrop] = useState<StreamDrop | "gone" | null>(cache.get(dropId) ?? null);

  useEffect(() => {
    if (cache.has(dropId)) return;
    getDrop(dropId)
      .then((d) => {
        cache.set(dropId, d);
        setDrop(d);
      })
      .catch(() => {
        cache.set(dropId, "gone");
        setDrop("gone");
      });
  }, [dropId]);

  if (drop === null) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={chat.inkMuted} />
      </View>
    );
  }
  if (drop === "gone") {
    return (
      <View style={[styles.card, styles.center]}>
        <Text style={styles.gone}>This drop isn't available</Text>
      </View>
    );
  }

  const theme = takeTheme(drop.id);
  return (
    <Pressable style={styles.card} onPress={() => navigation.navigate("UserProfile", { handle: drop.author.handle })}>
      <View style={styles.header}>
        <Avatar handle={drop.author.handle} displayName={drop.author.displayName} avatarUrl={drop.author.avatarUrl} size={22} radius={8} />
        <Text style={styles.handle} numberOfLines={1}>
          {drop.author.handle}
        </Text>
      </View>
      {drop.media[0] ? (
        <Image source={{ uri: drop.media[0].url }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.textCover, { backgroundColor: drop.kind === "take" ? theme.bg : "#16161A" }]}>
          <Text style={[styles.eyebrow, { color: drop.kind === "take" ? theme.ink : "#C8F169" }]}>{drop.kind === "take" ? "HOT TAKE" : "POLL"}</Text>
          <Text style={[styles.textBody, { color: drop.kind === "take" ? theme.ink : chat.ink }]} numberOfLines={4}>
            {drop.body}
          </Text>
        </View>
      )}
      {drop.caption || note ? (
        <Text style={styles.caption} numberOfLines={2}>
          {drop.caption ?? note}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 220, borderRadius: 18, overflow: "hidden", backgroundColor: chat.bubbleTheirs },
  center: { height: 120, alignItems: "center", justifyContent: "center" },
  gone: { fontFamily: fonts.body, fontSize: 13, color: chat.inkMuted },
  header: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 8 },
  handle: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 13, color: chat.ink },
  cover: { width: "100%", aspectRatio: 4 / 5 },
  textCover: { minHeight: 140, padding: 14, gap: 8, justifyContent: "center" },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.5 },
  textBody: { fontFamily: fonts.display, fontSize: 18, lineHeight: 21 },
  caption: { paddingHorizontal: 10, paddingVertical: 8, fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: chat.ink },
});
