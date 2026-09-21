import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "./Avatar";
import { CommentsModal } from "./CommentsModal";
import { HeartIcon, MessageSquareIcon, SendIcon, MoreHorizontalIcon } from "@/assets/icons";
import { reactToDrop } from "@/api/drops";
import type { Drop } from "@/api/types";

export function DropCard({ drop }: { drop: Drop }) {
  const [cheers, setCheers] = useState(drop.counts.reactions);
  const [cheered, setCheered] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [replyCount, setReplyCount] = useState(drop.counts.replies);
  const [commentsOpen, setCommentsOpen] = useState(false);
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

  async function onSend() {
    if (reposted) return;
    setReposted(true);
    try {
      await reactToDrop(drop.id, "repost");
    } catch {
      setReposted(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar handle={drop.author.handle} displayName={drop.author.displayName} avatarUrl={drop.author.avatarUrl} size={36} radius={18} />
          <View style={{ minWidth: 0 }}>
            <Text style={styles.handle}>{drop.author.handle}</Text>
            <Text style={styles.meta}>{[drop.location, dayjs(drop.createdAt).fromNow()].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>
        <MoreHorizontalIcon size={18} color={colors.inkFaint} />
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

      <View style={styles.divider} />

      <View style={styles.reactions}>
        <View style={styles.reactionsLeft}>
          <Pressable style={styles.reactionButton} onPress={onCheer}>
            <HeartIcon size={16} color={cheered ? colors.cheer : colors.ink} filled={cheered} strokeWidth={1.8} />
            <Text style={styles.reactionCount}>{cheers}</Text>
          </Pressable>
          <Pressable style={styles.reactionButton} onPress={() => setCommentsOpen(true)}>
            <MessageSquareIcon size={16} color={colors.ink} />
            <Text style={styles.reactionCount}>{replyCount}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.reactionButton} onPress={onSend}>
          <SendIcon size={16} color={reposted ? colors.accent : colors.ink} />
        </Pressable>
      </View>

      <CommentsModal
        visible={commentsOpen}
        dropId={drop.id}
        onClose={() => setCommentsOpen(false)}
        onCommented={() => setReplyCount((c) => c + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  handle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 1 },
  mediaWrap: { position: "relative" },
  media: { width: "100%", height: 200, borderRadius: 8, backgroundColor: colors.hairline },
  mediaError: { alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 4 },
  mediaErrorText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted },
  mediaErrorUrl: { fontFamily: fonts.body, fontSize: 10, color: colors.inkFaint, maxWidth: "100%" },
  mediaCount: { position: "absolute", right: 12, top: 12, backgroundColor: "rgba(23,20,18,0.6)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  mediaCountText: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#fff" },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.hairline },
  reactions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reactionsLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  reactionButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  reactionCount: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.ink },
});
