import { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { stream, fonts } from "@/theme/colors";
import { ChevronGlyph } from "@/components/stream/StreamIcons";
import { takeTheme } from "@/components/stream/format";
import type { StreamDrop } from "@/api/types";

const DOUBLE_TAP_MS = 280;

export function ZapGlyph({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M13.5 2L4 14h7l-1 8 9.5-12h-7z" />
    </Svg>
  );
}

/**
 * A drop, full screen: step through a profile's drops, spark it (a cheer) and
 * share it. On your own profile you can also pin it to the top or delete it
 * (tap twice to confirm); on someone else's you can open it to banter.
 */
export function DropViewer({
  drops,
  index,
  onClose,
  onIndex,
  onSpark,
  onShare,
  onTogglePin,
  onDelete,
  onOpen,
}: {
  drops: (StreamDrop & { pinnedAt?: string | null })[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
  onSpark: (drop: StreamDrop) => void;
  onShare: (drop: StreamDrop) => void;
  onTogglePin?: (drop: StreamDrop & { pinnedAt?: string | null }) => void;
  onDelete?: (drop: StreamDrop) => void;
  /** Open the full drop (comments and all). */
  onOpen?: (drop: StreamDrop) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photo, setPhoto] = useState(0);
  const beat = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);
  const drop = index !== null ? drops[index] : undefined;

  useEffect(() => {
    setConfirmDelete(false);
    setPhoto(0);
  }, [index]);

  if (!drop || index === null) return null;
  const theme = takeTheme(drop.id);

  function spark() {
    if (!drop) return;
    onSpark(drop);
    Animated.sequence([
      Animated.timing(beat, { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.timing(beat, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  function onMediaPress() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (!drop!.likedByMe) spark();
    } else lastTap.current = now;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={onClose} accessibilityLabel="Close drop">
            <ChevronGlyph direction="left" color={stream.ink} size={20} />
          </Pressable>
          <Text style={styles.title}>
            Drop {index + 1} of {drops.length}
          </Text>
          {onTogglePin ? (
            <Pressable
              onPress={() => onTogglePin(drop)}
              style={[styles.pin, drop.pinnedAt ? { backgroundColor: stream.lime, borderColor: stream.lime } : null]}
              accessibilityLabel={drop.pinnedAt ? "Unpin drop" : "Pin to top"}
            >
              <Text style={[styles.pinText, drop.pinnedAt ? { color: stream.onLime } : null]}>{drop.pinnedAt ? "📌 Pinned" : "Pin to top"}</Text>
            </Pressable>
          ) : drop.pinnedAt ? (
            <Text style={[styles.pinText, { color: stream.lime }]}>📌 Pinned</Text>
          ) : null}
        </View>

        <Pressable style={[styles.media, { backgroundColor: drop.kind === "take" ? theme.bg : stream.card }]} onPress={onMediaPress}>
          {drop.media[photo] ? (
            <Image source={{ uri: drop.media[photo].url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={styles.textDrop}>
              <Text style={[styles.textEyebrow, { color: drop.kind === "take" ? theme.ink : stream.lime }]}>{drop.kind === "poll" ? "POLL" : "HOT TAKE"}</Text>
              <Text style={[styles.textBody, { color: drop.kind === "take" ? theme.ink : stream.ink }]}>{drop.body}</Text>
            </View>
          )}
          {drop.media.length > 1 ? <Text style={styles.counter}>{photo + 1}/{drop.media.length}</Text> : null}
          {/* Arrows step photos within a drop first, then move between drops. */}
          {photo > 0 || index > 0 ? (
            <Pressable style={[styles.arrow, { left: 10 }]} onPress={() => (photo > 0 ? setPhoto(photo - 1) : onIndex(index - 1))} accessibilityLabel="Previous">
              <ChevronGlyph direction="left" size={16} />
            </Pressable>
          ) : null}
          {photo < drop.media.length - 1 || index < drops.length - 1 ? (
            <Pressable style={[styles.arrow, { right: 10 }]} onPress={() => (photo < drop.media.length - 1 ? setPhoto(photo + 1) : onIndex(index + 1))} accessibilityLabel="Next">
              <ChevronGlyph size={16} />
            </Pressable>
          ) : null}
        </Pressable>
        {drop.caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {drop.caption}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            onPress={spark}
            style={[styles.spark, { backgroundColor: drop.likedByMe ? stream.lime : stream.sheet }]}
            accessibilityLabel={drop.likedByMe ? "Remove spark" : "Spark"}
          >
            <Animated.View style={{ transform: [{ scale: beat }] }}>
              <ZapGlyph color={drop.likedByMe ? stream.onLime : stream.ink} />
            </Animated.View>
            {drop.countsHidden ? null : <Text style={[styles.sparkText, { color: drop.likedByMe ? stream.onLime : stream.ink }]}>{drop.counts.likes}</Text>}
          </Pressable>
          <Pressable style={styles.share} onPress={() => onShare(drop)}>
            <Text style={styles.shareText}>Share</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {onOpen ? (
            <Pressable style={styles.share} onPress={() => onOpen(drop)} accessibilityLabel="Open drop">
              <Text style={styles.shareText}>{drop.commentsOff ? "Open" : "💬 Banter"}</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={() => (confirmDelete ? onDelete(drop) : setConfirmDelete(true))}
              style={[styles.delete, confirmDelete && { backgroundColor: "rgba(255,107,107,0.14)", borderColor: stream.redSoft }]}
            >
              <Text style={styles.deleteText}>{confirmDelete ? "Tap to confirm" : "Delete"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: stream.bg, paddingTop: 50 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, height: 52, paddingLeft: 16, paddingRight: 10 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#18181C", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 16, color: stream.ink },
  pin: { height: 34, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: "#2E2E35", justifyContent: "center" },
  pinText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.ink },
  media: { flex: 1, marginTop: 6, marginHorizontal: 12, borderRadius: 26, overflow: "hidden" },
  textDrop: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
  textEyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.8 },
  textBody: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, letterSpacing: -0.8 },
  counter: { position: "absolute", top: 12, right: 12, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(12,12,14,0.78)", color: stream.ink, fontFamily: fonts.bodySemibold, fontSize: 12 },
  arrow: { position: "absolute", top: "50%", marginTop: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(245,243,239,0.92)", alignItems: "center", justifyContent: "center" },
  caption: { marginTop: 10, marginHorizontal: 18, fontFamily: fonts.body, fontSize: 14, color: stream.inkSoft },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 },
  spark: { flexDirection: "row", alignItems: "center", gap: 8, height: 46, paddingHorizontal: 16, borderRadius: 15 },
  sparkText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  share: { height: 46, paddingHorizontal: 16, borderRadius: 15, borderWidth: 1, borderColor: stream.raisedBorder, backgroundColor: stream.sheet, justifyContent: "center" },
  shareText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.ink },
  delete: { height: 46, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: "#2E2E35", justifyContent: "center" },
  deleteText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.redSoft },
});
