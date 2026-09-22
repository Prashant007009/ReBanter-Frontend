import { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { ReactionPicker } from "./ReactionPicker";
import type { Message } from "@/api/types";

const DOUBLE_TAP_MS = 280;

export function MessageBubble({
  message,
  mine,
  isFirstInGroup,
  isLastInGroup,
  currentUserId,
  seenLabel,
  onReact,
  onUnreact,
  onImagePress,
}: {
  message: Message;
  mine: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  currentUserId?: string;
  seenLabel?: string | null;
  onReact: (messageId: string, emoji: string) => void;
  onUnreact: (messageId: string) => void;
  onImagePress: (uri: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const lastTapAt = useRef(0);
  const myReaction = currentUserId ? message.reactions.find((r) => r.userId === currentUserId) : undefined;

  function handlePress() {
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0;
      if (myReaction?.emoji === "❤️") onUnreact(message.id);
      else onReact(message.id, "❤️");
    } else {
      lastTapAt.current = now;
    }
  }

  const cornerStyle = mine
    ? { borderBottomRightRadius: isLastInGroup ? 6 : 20 }
    : { borderBottomLeftRadius: isLastInGroup ? 6 : 20 };

  const content =
    message.kind === "sticker" ? (
      <Pressable onPress={handlePress} onLongPress={() => setPickerOpen(true)}>
        <Text style={styles.stickerText}>{message.body}</Text>
      </Pressable>
    ) : message.kind === "image" && message.imageUrl ? (
      <Pressable
        style={[styles.imageBubble, cornerStyle]}
        onPress={() => (Date.now() - lastTapAt.current < DOUBLE_TAP_MS ? handlePress() : onImagePress(message.imageUrl!))}
        onLongPress={() => setPickerOpen(true)}
      >
        <Image source={{ uri: message.imageUrl }} style={styles.imageBubbleImage} resizeMode="cover" />
      </Pressable>
    ) : (
      <Pressable
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, cornerStyle]}
        onPress={handlePress}
        onLongPress={() => setPickerOpen(true)}
      >
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
      </Pressable>
    );

  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginTop: isFirstInGroup ? 14 : 3 }}>
      <View style={{ maxWidth: "78%" }}>
        {content}
        {message.reactions.length > 0 ? (
          <View style={[styles.reactionsBadge, mine ? { right: 8 } : { left: 8 }]}>
            {message.reactions.map((r) => (
              <Text key={r.id} style={styles.reactionEmoji}>
                {r.emoji}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {isLastInGroup ? (
        <View style={styles.metaRow}>
          <Text style={styles.bubbleTime}>{dayjs(message.createdAt).format("H:mm")}</Text>
          {seenLabel ? <Text style={styles.seenLabel}>{seenLabel}</Text> : null}
        </View>
      ) : null}
      <ReactionPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(emoji) => {
          setPickerOpen(false);
          if (myReaction?.emoji === emoji) onUnreact(message.id);
          else onReact(message.id, emoji);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleTheirs: {
    backgroundColor: colors.surfaceRaised,
    shadowColor: "#171412",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleMine: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  bubbleTextMine: { color: "#fff" },
  stickerText: { fontSize: 52, lineHeight: 60, marginVertical: 4 },
  imageBubble: { width: 220, height: 220, borderRadius: 20, overflow: "hidden", shadowColor: "#171412", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  imageBubbleImage: { width: "100%", height: "100%", backgroundColor: colors.hairline },
  reactionsBadge: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    backgroundColor: colors.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.canvas,
    shadowColor: "#171412",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  reactionEmoji: { fontSize: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, marginHorizontal: 4 },
  bubbleTime: { fontFamily: fonts.body, fontSize: 10, color: colors.inkFaint },
  seenLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.accent },
});
