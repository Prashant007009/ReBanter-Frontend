import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "./Avatar";
import { reactToDrop } from "@/api/drops";
import type { Drop } from "@/api/types";

export function DropCard({ drop }: { drop: Drop }) {
  const [cheers, setCheers] = useState(drop.counts.reactions);
  const [cheered, setCheered] = useState(false);
  const cover = drop.media[0];

  async function onCheer() {
    if (cheered) return;
    setCheered(true);
    setCheers((c) => c + 1);
    try {
      await reactToDrop(drop.id, "cheer");
    } catch {
      setCheered(false);
      setCheers((c) => c - 1);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar handle={drop.author.handle} displayName={drop.author.displayName} avatarUrl={drop.author.avatarUrl} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.handle}>{drop.author.handle}</Text>
          <Text style={styles.meta}>
            {[drop.location, dayjs(drop.createdAt).fromNow()].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>

      {cover ? <Image source={{ uri: cover.url }} style={styles.media} /> : null}

      {drop.caption ? <Text style={styles.caption}>{drop.caption}</Text> : null}

      <View style={styles.reactions}>
        <Pressable style={styles.reactionButton} onPress={onCheer}>
          <Text style={[styles.reactionIcon, cheered && { color: colors.cheer }]}>▲</Text>
          <Text style={styles.reactionCount}>{cheers}</Text>
        </Pressable>
        <View style={styles.reactionButton}>
          <Text style={styles.reactionIcon}>↩</Text>
          <Text style={styles.reactionCount}>{drop.counts.replies}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 26,
    overflow: "hidden",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14 },
  handle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  media: { width: "100%", height: 300, backgroundColor: colors.hairline },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink, padding: 14, paddingBottom: 6 },
  reactions: { flexDirection: "row", alignItems: "center", gap: 18, padding: 14 },
  reactionButton: { flexDirection: "row", alignItems: "center", gap: 7 },
  reactionIcon: { fontSize: 16, color: colors.ink },
  reactionCount: { fontFamily: fonts.displaySemibold, fontSize: 13, color: colors.ink },
});
