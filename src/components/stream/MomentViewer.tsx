import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import dayjs from "@/lib/dayjs";
import { stream, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { likeMoment, markMomentViewed } from "@/api/moments";
import { sendDirect } from "@/api/direct";
import type { MomentGroup } from "@/api/types";
import { CloseGlyph, HeartGlyph, PlayPauseGlyph, ShareGlyph } from "./StreamIcons";
import { useToast } from "./Toast";

const FRAME_MS = 5000;
const TICK_MS = 50;
const TINTS = ["#1C2430", "#2A211C", "#1A2226", "#221E30", "#2B1E2A", "#22281A", "#241E2E"];

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * Full-screen Moments player: frames auto-advance every 5s across authors,
 * tap the left/right third to step, pause/resume, like a frame, or reply —
 * replies go to the author's Direct inbox.
 */
export function MomentViewer({
  groups,
  startGroup,
  myUserId,
  onClose,
  onFrameSeen,
}: {
  groups: MomentGroup[];
  startGroup: number | null;
  myUserId?: string;
  onClose: () => void;
  onFrameSeen: (groupIndex: number, frameIndex: number) => void;
}) {
  const toast = useToast();
  const [pos, setPos] = useState({ g: 0, f: 0 });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState("");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const open = startGroup !== null;

  // Start on the author's first unseen frame.
  useEffect(() => {
    if (startGroup === null) return;
    const g = groups[startGroup];
    const firstUnseen = g ? g.frames.findIndex((fr) => !fr.seen) : 0;
    setPos({ g: startGroup, f: Math.max(firstUnseen, 0) });
    setProgress(0);
    setPaused(false);
    setReply("");
  }, [startGroup]);

  const group = open ? groups[pos.g] : undefined;
  const frame = group?.frames[pos.f];
  const isMine = group?.author.id === myUserId;

  useEffect(() => {
    if (!open || !frame) return;
    onFrameSeen(pos.g, pos.f);
    if (!isMine && !frame.seen) markMomentViewed(frame.id).catch(() => {});
  }, [open, frame?.id]);

  const step = useCallback(
    (dir: 1 | -1) => {
      setProgress(0);
      setPos((p) => {
        let { g, f } = p;
        f += dir;
        if (f >= groups[g].frames.length) {
          g += 1;
          f = 0;
        } else if (f < 0) {
          if (g === 0) f = 0;
          else {
            g -= 1;
            f = groups[g].frames.length - 1;
          }
        }
        if (g >= groups.length) {
          setTimeout(onClose, 0);
          return p;
        }
        return { g, f };
      });
    },
    [groups, onClose]
  );

  const progressRef = useRef(progress);
  progressRef.current = progress;
  useEffect(() => {
    if (!open || paused) return;
    const t = setInterval(() => {
      const next = progressRef.current + TICK_MS / FRAME_MS;
      if (next >= 1) step(1);
      else setProgress(next);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [open, paused, step]);

  async function sendReply() {
    const text = reply.trim();
    if (!text || !group || !frame) return;
    setReply("");
    setPaused(false);
    try {
      const context = frame.caption ? `“${frame.caption}”` : "your moment";
      await sendDirect(group.author.id, { kind: "text", body: `↩︎ Replied to ${context}: ${text}` });
      toast("Reply sent to Direct");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send that reply");
    }
  }

  function toggleLike() {
    if (!frame) return;
    const next = !(liked[frame.id] ?? frame.likedByMe);
    setLiked((l) => ({ ...l, [frame.id]: next }));
    likeMoment(frame.id, next).catch(() => setLiked((l) => ({ ...l, [frame.id]: !next })));
  }

  if (!open || !group || !frame) return null;
  const isLiked = liked[frame.id] ?? frame.likedByMe;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: tintFor(group.author.id) }]}>
        {frame.mediaUrl ? <Image source={{ uri: frame.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}

        <Pressable style={[styles.tapZone, { left: 0 }]} onPress={() => step(-1)} accessibilityLabel="Previous moment" />
        <Pressable style={[styles.tapZone, { right: 0 }]} onPress={() => step(1)} accessibilityLabel="Next moment" />

        <LinearGradient colors={["rgba(0,0,0,0.6)", "transparent"]} style={styles.topShade} pointerEvents="none" />
        <View style={styles.bars} pointerEvents="none">
          {group.frames.map((fr, i) => (
            <View key={fr.id} style={styles.bar}>
              <View style={[styles.barFill, { width: `${(i < pos.f ? 1 : i === pos.f ? progress : 0) * 100}%` }]} />
            </View>
          ))}
        </View>
        <View style={styles.header}>
          <Avatar handle={group.author.handle} displayName={group.author.displayName} avatarUrl={group.author.avatarUrl} size={34} radius={12} />
          <Text style={styles.handle}>{group.author.handle}</Text>
          <Text style={styles.ago}>{dayjs(frame.createdAt).fromNow(true)}</Text>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.iconButton} onPress={() => setPaused((p) => !p)} accessibilityLabel={paused ? "Play" : "Pause"}>
            <PlayPauseGlyph paused={paused} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onClose} accessibilityLabel="Close moments">
            <CloseGlyph />
          </Pressable>
        </View>

        {frame.caption ? (
          <View style={styles.captionWrap} pointerEvents="none">
            <Text style={[styles.caption, { backgroundColor: frame.captionBg ?? stream.ink, color: frame.captionInk ?? stream.bg }]}>{frame.caption}</Text>
          </View>
        ) : null}

        <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} style={styles.bottomShade} pointerEvents="none" />
        <View style={styles.footer}>
          {isMine ? (
            <Text style={styles.mineNote}>Your moment · disappears in {24 - dayjs().diff(dayjs(frame.createdAt), "hour")}h</Text>
          ) : (
            <TextInput
              value={reply}
              onChangeText={setReply}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onSubmitEditing={sendReply}
              placeholder={`Reply to ${group.author.handle}…`}
              placeholderTextColor="rgba(245,243,239,0.7)"
              style={styles.replyInput}
              returnKeyType="send"
            />
          )}
          <Pressable style={styles.footerButton} onPress={toggleLike} accessibilityLabel={isLiked ? "Unlike moment" : "Like moment"}>
            <HeartGlyph size={27} filled={isLiked} />
          </Pressable>
          {!isMine ? (
            <Pressable style={styles.footerButton} onPress={sendReply} accessibilityLabel="Send reply">
              <ShareGlyph size={25} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tapZone: { position: "absolute", top: 120, bottom: 110, width: "32%" },
  topShade: { position: "absolute", left: 0, right: 0, top: 0, height: 150 },
  bars: { position: "absolute", left: 12, right: 12, top: 56, flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#fff" },
  header: { position: "absolute", left: 14, right: 8, top: 70, flexDirection: "row", alignItems: "center", gap: 10 },
  handle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.ink },
  ago: { fontFamily: fonts.body, fontSize: 13, color: stream.inkSoft },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  captionWrap: { position: "absolute", left: 24, right: 24, top: "44%", alignItems: "center" },
  caption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: "hidden",
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.5,
    textAlign: "center",
    transform: [{ rotate: "-2deg" }],
  },
  bottomShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 130 },
  footer: { position: "absolute", left: 14, right: 10, bottom: 38, flexDirection: "row", alignItems: "center", gap: 6 },
  replyInput: {
    flex: 1,
    minWidth: 0,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.65)",
    backgroundColor: "rgba(12,12,14,0.45)",
    color: stream.ink,
    fontFamily: fonts.body,
    fontSize: 14.5,
  },
  mineNote: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: stream.inkSoft },
  footerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
