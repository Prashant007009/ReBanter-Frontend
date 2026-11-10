import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import dayjs from "@/lib/dayjs";
import { chat, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { GifCard } from "./GifCard";
import { SharedDropCard } from "./SharedDropCard";
import { EmojiSticker, WordSticker } from "./StickerArt";
import { ClockTickIcon, DoubleTickIcon, PlusThinIcon, SingleTickIcon } from "./ChatIcons";
import { QUICK_REACTIONS, decodeSticker, isBigEmoji } from "./expressions";
import type { Message, UserSummary } from "@/api/types";

const DOUBLE_TAP_MS = 280;

/** Scale-and-fade in on mount — the design's `rbPop`. */
export function PopIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export type ChatMessage = Message & { pending?: boolean };

export function MessageBubble({
  message,
  mine,
  peer,
  joinsPrev,
  joinsNext,
  currentUserId,
  reactOpen,
  onToggleReact,
  onReact,
  onUnreact,
  onMoreReactions,
  onImagePress,
}: {
  message: ChatMessage;
  mine: boolean;
  peer: Pick<UserSummary, "handle" | "displayName" | "avatarUrl">;
  /** Same sender directly above/below — squares off the touching corners. */
  joinsPrev: boolean;
  joinsNext: boolean;
  currentUserId?: string;
  reactOpen: boolean;
  onToggleReact: (messageId: string | null) => void;
  onReact: (messageId: string, emoji: string) => void;
  onUnreact: (messageId: string) => void;
  onMoreReactions: (messageId: string) => void;
  onImagePress: (uri: string) => void;
}) {
  const lastTapAt = useRef(0);
  const myReaction = currentUserId ? message.reactions.find((r) => r.userId === currentUserId) : undefined;

  function pick(emoji: string) {
    onToggleReact(null);
    if (myReaction?.emoji === emoji) onUnreact(message.id);
    else onReact(message.id, emoji);
  }

  // Tap toggles the quick-reaction bar; a second tap inside the window is a double-tap ❤️.
  function handlePress() {
    if (message.pending) return;
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0;
      pick("❤️");
    } else {
      lastTapAt.current = now;
      onToggleReact(reactOpen ? null : message.id);
    }
  }

  const radius = mine
    ? { borderTopLeftRadius: 20, borderTopRightRadius: joinsPrev ? 6 : 20, borderBottomRightRadius: joinsNext ? 6 : 20, borderBottomLeftRadius: 20 }
    : { borderTopLeftRadius: joinsPrev ? 6 : 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: joinsNext ? 6 : 20 };

  let content: ReactNode;
  if (message.undecryptable) {
    content = (
      <View style={[styles.bubble, styles.bubbleLocked, radius]}>
        <Text style={styles.lockedText}>🔒 Can't decrypt this message on this device</Text>
      </View>
    );
  } else if (message.kind === "drop" && message.dropId) {
    content = <SharedDropCard dropId={message.dropId} note={message.body} />;
  } else if (message.kind === "sticker") {
    const s = decodeSticker(message.body);
    content =
      s.kind === "gif" ? (
        <GifCard gif={s.gif} width={204} height={s.gif.h} />
      ) : s.kind === "text" ? (
        <WordSticker sticker={s.sticker} />
      ) : (
        <EmojiSticker emoji={s.emoji} />
      );
  } else if (message.kind === "image" && message.imageUrl) {
    content = (
      <View style={[styles.imageBubble, radius]}>
        <Image source={{ uri: message.imageUrl }} style={styles.imageBubbleImage} resizeMode="cover" />
      </View>
    );
  } else if (isBigEmoji(message.body)) {
    content = <Text style={styles.bigEmoji}>{message.body}</Text>;
  } else if (mine) {
    content = (
      <View style={[styles.bubble, styles.bubbleMine, radius]}>
        <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{message.body}</Text>
        <View style={styles.inlineMeta}>
          <Text style={styles.inlineTime}>{dayjs(message.createdAt).format("h:mm A")}</Text>
          {message.pending ? (
            <ClockTickIcon color={chat.onMineMuted} />
          ) : message.seenAt ? (
            <DoubleTickIcon color={chat.readTick} />
          ) : (
            <SingleTickIcon color={chat.onMineMuted} />
          )}
        </View>
      </View>
    );
  } else {
    content = (
      <View style={[styles.bubble, styles.bubbleTheirs, radius]}>
        <Text style={styles.bubbleText}>{message.body}</Text>
      </View>
    );
  }

  const isImage = message.kind === "image" && !!message.imageUrl;

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, message.reactions.length > 0 && styles.rowWithReaction]}>
      {!mine ? (
        joinsNext ? (
          <View style={styles.avatarSpacer} />
        ) : (
          <Avatar handle={peer.handle} displayName={peer.displayName} avatarUrl={peer.avatarUrl} size={28} radius={14} />
        )
      ) : null}
      <View style={[styles.stack, { alignItems: mine ? "flex-end" : "flex-start" }]}>
        {reactOpen ? (
          <PopIn style={[styles.reactBar, mine ? { right: -4 } : { left: -4 }]}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable key={emoji} onPress={() => pick(emoji)} style={[styles.reactButton, myReaction?.emoji === emoji && styles.reactButtonActive]}>
                <Text style={styles.reactEmoji}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.reactMore}
              onPress={() => {
                onToggleReact(null);
                onMoreReactions(message.id);
              }}
            >
              <PlusThinIcon />
            </Pressable>
          </PopIn>
        ) : null}
        <Pressable
          onPress={isImage ? () => (Date.now() - lastTapAt.current < DOUBLE_TAP_MS ? handlePress() : onImagePress(message.imageUrl!)) : handlePress}
          onLongPress={() => !message.pending && onToggleReact(message.id)}
          style={{ opacity: message.pending && message.kind !== "text" ? 0.6 : 1 }}
        >
          {content}
        </Pressable>
        {message.reactions.length > 0 ? (
          <PopIn style={[styles.reactionsBadge, mine ? { right: 8 } : { left: 8 }]}>
            <Text style={styles.reactionsText}>{message.reactions.map((r) => r.emoji).join("")}</Text>
          </PopIn>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowMine: { justifyContent: "flex-end", paddingLeft: 56 },
  rowTheirs: { paddingRight: 52 },
  rowWithReaction: { marginBottom: 14 },
  avatarSpacer: { width: 28 },
  stack: { flexShrink: 1, minWidth: 0 },
  bubble: { paddingHorizontal: 13, paddingVertical: 9 },
  bubbleTheirs: { backgroundColor: chat.bubbleTheirs },
  bubbleLocked: { backgroundColor: "transparent", borderWidth: 1, borderColor: chat.fieldBorder },
  lockedText: { fontFamily: fonts.body, fontSize: 13.5, fontStyle: "italic", color: chat.inkMuted },
  bubbleMine: {
    backgroundColor: chat.bubbleMine,
    paddingRight: 11,
    paddingBottom: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    columnGap: 8,
  },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20.5, color: chat.ink, flexShrink: 1 },
  bubbleTextMine: { color: chat.onMine },
  inlineMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 1 },
  inlineTime: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: chat.onMineMuted },
  bigEmoji: { fontSize: 46, lineHeight: 52 },
  imageBubble: { width: 220, height: 220, overflow: "hidden", backgroundColor: chat.bubbleTheirs },
  imageBubbleImage: { width: "100%", height: "100%" },
  reactBar: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 8,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    paddingHorizontal: 5,
    paddingVertical: 4,
    backgroundColor: chat.bubbleTheirs,
    borderWidth: 1,
    borderColor: chat.popBorder,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 15,
    elevation: 10,
  },
  reactButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  reactButtonActive: { backgroundColor: "#3A3A42" },
  reactEmoji: { fontSize: 22 },
  reactMore: { width: 34, height: 34, borderRadius: 17, backgroundColor: chat.popMore, alignItems: "center", justifyContent: "center" },
  reactionsBadge: {
    position: "absolute",
    bottom: -15,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: chat.bubbleTheirs,
    borderWidth: 2,
    borderColor: chat.bg,
    borderRadius: 999,
  },
  reactionsText: { fontSize: 13, lineHeight: 18 },
});
