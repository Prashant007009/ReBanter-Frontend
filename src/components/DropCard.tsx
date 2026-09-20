import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "./Avatar";
import { ReplyModal } from "./ReplyModal";
import { ZapIcon, ReplyIcon, RepostIcon, SaveIcon, MoreHorizontalIcon } from "@/assets/icons";
import { reactToDrop } from "@/api/drops";
import type { Drop } from "@/api/types";

export function DropCard({ drop }: { drop: Drop }) {
  const [cheers, setCheers] = useState(drop.counts.reactions);
  const [cheered, setCheered] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [replyCount, setReplyCount] = useState(drop.counts.replies);
  const [replyOpen, setReplyOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
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

  async function onRepost() {
    if (reposted) return;
    setReposted(true);
    try {
      await reactToDrop(drop.id, "repost");
    } catch {
      setReposted(false);
    }
  }

  async function onSave() {
    setSaved((s) => !s);
    try {
      await reactToDrop(drop.id, "save");
    } catch {
      setSaved((s) => !s);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar handle={drop.author.handle} displayName={drop.author.displayName} avatarUrl={drop.author.avatarUrl} size={38} radius={13} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.handle}>{drop.author.handle}</Text>
          <Text style={styles.meta}>{[drop.location, dayjs(drop.createdAt).fromNow()].filter(Boolean).join(" · ")}</Text>
        </View>
        <MoreHorizontalIcon size={19} color={colors.inkFaint} />
      </View>

      {cover ? (
        <View style={styles.mediaWrap}>
          {mediaFailed ? (
            <View style={[styles.media, styles.mediaError]}>
              <Text style={styles.mediaErrorText}>Couldn't load this image</Text>
              <Text style={styles.mediaErrorUrl} numberOfLines={1}>
                {cover.url}
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: cover.url }}
              style={styles.media}
              resizeMode="cover"
              onError={(e) => {
                // eslint-disable-next-line no-console
                console.warn("DropCard image failed to load:", cover.url, e.nativeEvent);
                setMediaFailed(true);
              }}
            />
          )}
          {drop.media.length > 1 ? (
            <View style={styles.mediaCount}>
              <Text style={styles.mediaCountText}>1/{drop.media.length}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {drop.caption ? <Text style={styles.caption}>{drop.caption}</Text> : null}

      <View style={styles.reactions}>
        <Pressable style={styles.reactionButton} onPress={onCheer}>
          <ZapIcon size={19} color={colors.cheer} />
          <Text style={styles.reactionCount}>{cheers}</Text>
        </Pressable>
        <Pressable style={styles.reactionButton} onPress={() => setReplyOpen(true)}>
          <ReplyIcon size={19} color={colors.ink} />
          <Text style={styles.reactionCount}>{replyCount}</Text>
        </Pressable>
        <Pressable style={styles.reactionButton} onPress={onRepost}>
          <RepostIcon size={19} color={reposted ? colors.accent : colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onSave}>
          <SaveIcon size={19} color={saved ? colors.accent : colors.ink} />
        </Pressable>
      </View>

      <ReplyModal
        visible={replyOpen}
        dropId={drop.id}
        onClose={() => setReplyOpen(false)}
        onReplied={() => setReplyCount((c) => c + 1)}
      />
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
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  handle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  mediaWrap: { position: "relative" },
  media: { width: "100%", height: 300, backgroundColor: colors.hairline },
  mediaError: { alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 4 },
  mediaErrorText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted },
  mediaErrorUrl: { fontFamily: fonts.body, fontSize: 10, color: colors.inkFaint, maxWidth: "100%" },
  mediaCount: { position: "absolute", right: 12, top: 12, backgroundColor: "rgba(23,20,18,0.45)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  mediaCountText: { fontFamily: fonts.bodyBold, fontSize: 10, color: "#fff" },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.ink, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  reactions: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  reactionButton: { flexDirection: "row", alignItems: "center", gap: 7 },
  reactionCount: { fontFamily: fonts.displaySemibold, fontSize: 13, color: colors.ink },
});
