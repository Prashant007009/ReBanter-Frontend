import { memo, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import dayjs from "@/lib/dayjs";
import { stream, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { PopIn } from "@/components/chat/MessageBubble";
import type { StreamDrop } from "@/api/types";
import { MomentRing } from "./MomentRing";
import { compact, takeTheme } from "./format";
import {
  BookmarkGlyph,
  ChatGlyph,
  CheckGlyph,
  ChevronGlyph,
  DotsGlyph,
  HeartGlyph,
  ShareGlyph,
  VerifiedGlyph,
} from "./StreamIcons";

const DOUBLE_TAP_MS = 280;
const ASPECT = { "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9 } as const;

/** Readable ink (near-black or white) for a card colour. */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? "#0C0C0E" : "#FFFFFF";
}

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

export type PostActions = {
  onLike: (drop: StreamDrop, force?: boolean) => void;
  onSave: (drop: StreamDrop) => void;
  onComments: (drop: StreamDrop) => void;
  onShare: (drop: StreamDrop) => void;
  onFollow: (drop: StreamDrop) => void;
  onVote: (drop: StreamDrop, optionId: string) => void;
  onStance: (drop: StreamDrop, stance: "facts" | "cap") => void;
  onCopyLink: (drop: StreamDrop) => void;
  onHide: (drop: StreamDrop, report: boolean) => void;
  onOpenMoment: (authorId: string) => void;
  onOpenProfile: (handle: string) => void;
  onToggleMenu: (dropId: string | null) => void;
  /** Open the composer to remix this take / poll (only when the author allows it). */
  onRemix?: (drop: StreamDrop) => void;
};

/** One Stream card (photo · carousel · hot take · poll), per the Rebanter Stream design. */
export const StreamPost = memo(function StreamPost({
  drop,
  ring,
  menuOpen,
  followedNow,
  actions,
}: {
  drop: StreamDrop;
  /** The author's Moments, for the ring around their avatar. */
  ring: { frames: number; seen: boolean } | null;
  menuOpen: boolean;
  /** Keep showing "Following"/"Requested" after a follow tap this session. */
  followedNow: boolean;
  actions: PostActions;
}) {
  const [burstKey, setBurstKey] = useState(0);
  const lastTap = useRef(0);
  const a = actions;

  function onMediaPress() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      a.onLike(drop, true);
      setBurstKey((k) => k + 1);
    } else {
      lastTap.current = now;
    }
  }

  const showFollow = drop.relationship === "none" || drop.relationship === "incoming" || followedNow;
  const followLabel =
    drop.relationship === "crew" ? "Following" : drop.relationship === "requested" ? "Requested" : drop.relationship === "incoming" ? "Accept" : "Follow";
  const followActive = drop.relationship === "none" || drop.relationship === "incoming";
  const scheduled = !!drop.publishAt && new Date(drop.publishAt).getTime() > Date.now();
  const audienceLabel = drop.audience === "crew" ? "👥 Crew" : drop.audience === "close" ? "💚 Close circle" : null;
  const sub = [
    drop.location,
    drop.soundLabel ? `♪ ${drop.soundLabel}` : null,
    audienceLabel,
    scheduled ? `🕒 Scheduled · ${dayjs(drop.publishAt).format("ddd h:mm A")}` : dayjs(drop.createdAt).fromNow(),
  ]
    .filter(Boolean)
    .join(" · ");
  const top = drop.topReply;

  return (
    <View style={styles.article}>
      <View style={[styles.header, menuOpen && { zIndex: 15 }]}>
        <Pressable
          onPress={() => (ring ? a.onOpenMoment(drop.author.id) : a.onOpenProfile(drop.author.handle))}
          accessibilityLabel={ring ? `Watch ${drop.author.handle}'s moments` : `${drop.author.handle}'s profile`}
        >
          <MomentRing size={42} radius={15} frames={ring?.frames ?? 0} seen={ring?.seen ?? true} thickness={2.2}>
            <Avatar handle={drop.author.handle} displayName={drop.author.displayName} avatarUrl={drop.author.avatarUrl} size={34} radius={12} />
          </MomentRing>
        </Pressable>
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Pressable onPress={() => a.onOpenProfile(drop.author.handle)}>
              <Text style={styles.handle}>{drop.author.handle}</Text>
            </Pressable>
            {drop.author.isVerified ? <VerifiedGlyph /> : null}
            {showFollow && drop.relationship !== "self" ? (
              <Pressable onPress={() => a.onFollow(drop)} disabled={!followActive} hitSlop={6}>
                <Text style={[styles.follow, { color: followActive ? stream.lime : stream.inkMuted }]}>· {followLabel}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <Pressable style={styles.menuButton} onPress={() => a.onToggleMenu(menuOpen ? null : drop.id)} accessibilityLabel="Post options">
          <DotsGlyph />
        </Pressable>
        {menuOpen ? (
          <PopIn style={styles.menu}>
            <MenuItem label={drop.savedByMe ? "Remove from saved" : "Save"} onPress={() => a.onSave(drop)} />
            <MenuItem label="Copy link" onPress={() => a.onCopyLink(drop)} />
            {drop.allowRemix !== false && drop.relationship !== "self" && (drop.kind === "take" || drop.kind === "poll") && a.onRemix ? (
              <MenuItem label="Remix" onPress={() => a.onRemix!(drop)} />
            ) : null}
            <MenuItem label="Not interested" onPress={() => a.onHide(drop, false)} />
            <MenuItem label="Report" danger onPress={() => a.onHide(drop, true)} />
          </PopIn>
        ) : null}
      </View>

      {drop.kind === "take" && drop.take ? (
        <Pressable onPress={onMediaPress}>
          <TakeCard drop={drop} onStance={(s) => a.onStance(drop, s)} />
          <HeartBurst burstKey={burstKey} />
        </Pressable>
      ) : drop.kind === "poll" && drop.poll ? (
        <PollCard drop={drop} onVote={(id) => a.onVote(drop, id)} />
      ) : drop.media.length > 1 ? (
        <Carousel drop={drop} onPress={onMediaPress} burstKey={burstKey} />
      ) : drop.media.length === 1 ? (
        <Pressable onPress={onMediaPress} style={styles.mediaFrame}>
          <Photo uri={drop.media[0].url} fixedRatio={drop.aspect ? ASPECT[drop.aspect] : undefined} alt={drop.altText} />
          <HeartBurst burstKey={burstKey} />
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => a.onLike(drop)} accessibilityLabel={drop.likedByMe ? "Unlike" : "Like"}>
          <Beat active={drop.likedByMe}>
            <HeartGlyph filled={drop.likedByMe} />
          </Beat>
          {drop.countsHidden ? null : <Text style={styles.actionCount}>{compact(drop.counts.likes)}</Text>}
        </Pressable>
        <Pressable
          style={[styles.action, drop.commentsOff && { opacity: 0.4 }]}
          onPress={() => a.onComments(drop)}
          accessibilityLabel={drop.commentsOff ? "Banter is off" : "Comments"}
        >
          <ChatGlyph size={24} strokeWidth={1.9} />
          <Text style={styles.actionCount}>{compact(drop.counts.replies)}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => a.onShare(drop)} accessibilityLabel="Share">
          <ShareGlyph />
          <Text style={styles.actionCount}>{compact(drop.counts.shares)}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.saveButton} onPress={() => a.onSave(drop)} accessibilityLabel={drop.savedByMe ? "Remove from saved" : "Save"}>
          <Beat active={drop.savedByMe}>
            <BookmarkGlyph filled={drop.savedByMe} color={drop.savedByMe ? stream.lime : stream.ink} />
          </Beat>
        </Pressable>
      </View>

      {drop.caption ? (
        <Text style={styles.caption}>
          <Text style={styles.captionHandle}>{drop.author.handle}</Text> {drop.caption}
        </Text>
      ) : null}

      {top ? (
        <>
          <Pressable style={styles.topComment} onPress={() => a.onComments(drop)}>
            <Avatar handle={top.author.handle} displayName={top.author.displayName} avatarUrl={top.author.avatarUrl} size={24} radius={12} />
            <Text style={styles.topBubble}>
              <Text style={styles.topWho}>{top.author.handle}</Text> {top.body}
            </Text>
          </Pressable>
          <Pressable onPress={() => a.onComments(drop)} style={styles.viewAll}>
            <Text style={styles.viewAllText}>{drop.counts.replies > 1 ? `View all ${drop.counts.replies} comments` : "Add to the banter"}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
});

function MenuItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: stream.raisedHover }]}>
      <Text style={[styles.menuText, danger && { color: stream.redSoft }]}>{label}</Text>
    </Pressable>
  );
}

/** Image at its natural aspect ratio (clamped between 4:5 and 16:9). */
function Photo({ uri, fixedRatio, alt }: { uri: string; fixedRatio?: number; alt?: string | null }) {
  const [ratio, setRatio] = useState(fixedRatio ?? 4 / 5);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (fixedRatio) return;
    Image.getSize(
      uri,
      (w, h) => setRatio(Math.min(16 / 9, Math.max(4 / 5, w / h))),
      () => {}
    );
  }, [uri, fixedRatio]);
  return failed ? (
    <View style={[styles.photo, styles.photoFailed, { aspectRatio: ratio }]}>
      <Text style={styles.photoFailedText}>Couldn't load this photo</Text>
    </View>
  ) : (
    <Image
      source={{ uri }}
      style={[styles.photo, { aspectRatio: ratio }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityLabel={alt ?? undefined}
      accessible={!!alt}
    />
  );
}

function Carousel({ drop, onPress, burstKey }: { drop: StreamDrop; onPress: () => void; burstKey: number }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const ref = useRef<ScrollView>(null);
  const count = drop.media.length;

  const go = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i));
    setIndex(next);
    ref.current?.scrollTo({ x: next * width, animated: true });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View
      style={[styles.mediaFrame, styles.carousel, drop.aspect ? { aspectRatio: ASPECT[drop.aspect] } : null]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={drop.altText ?? undefined}
    >
      {width > 0 ? (
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          scrollEventThrottle={16}
        >
          {drop.media.map((m) => (
            <Pressable key={m.id} onPress={onPress} style={{ width, height: "100%" }}>
              <Image source={{ uri: m.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Text style={styles.counter} pointerEvents="none">
        {index + 1}/{count}
      </Text>
      {index > 0 ? (
        <Pressable style={[styles.arrow, { left: 10 }]} onPress={() => go(index - 1)} accessibilityLabel="Previous photo">
          <ChevronGlyph direction="left" />
        </Pressable>
      ) : null}
      {index < count - 1 ? (
        <Pressable style={[styles.arrow, { right: 10 }]} onPress={() => go(index + 1)} accessibilityLabel="Next photo">
          <ChevronGlyph />
        </Pressable>
      ) : null}
      <View style={styles.dots} pointerEvents="none">
        {drop.media.map((m, i) => (
          <View key={m.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <HeartBurst burstKey={burstKey} />
    </View>
  );
}

function TakeCard({ drop, onStance }: { drop: StreamDrop; onStance: (s: "facts" | "cap") => void }) {
  const t = drop.take!;
  const theme = drop.takeColor ? { bg: drop.takeColor, ink: inkOn(drop.takeColor) } : takeTheme(drop.id);
  const total = Math.max(1, t.facts + t.cap);
  const pct = (t.facts / total) * 100;
  const button = (s: "facts" | "cap", label: string, n: number) => {
    const active = t.myStance === s;
    return (
      <Pressable
        onPress={() => onStance(s)}
        style={[styles.stanceButton, { backgroundColor: active ? stream.bg : "rgba(12,12,14,0.22)" }]}
        accessibilityLabel={`${label}${active ? " (your vote)" : ""}`}
      >
        <Text style={[styles.stanceText, { color: active ? stream.lime : theme.ink }]}>
          {label} · {compact(n)}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.take, { backgroundColor: theme.bg }]}>
      <Text style={[styles.takeEyebrow, { color: theme.ink }]}>HOT TAKE</Text>
      <Text style={[styles.takeText, { color: theme.ink }]}>{drop.body}</Text>
      <View style={{ gap: 8 }}>
        <View style={styles.takeTrack}>
          <View style={[styles.takeFill, { width: `${pct}%` }]} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {button("facts", "🔥 Facts", t.facts)}
          {button("cap", "🧢 Cap", t.cap)}
        </View>
      </View>
    </View>
  );
}

function PollCard({ drop, onVote }: { drop: StreamDrop; onVote: (optionId: string) => void }) {
  const p = drop.poll!;
  // A closed poll shows final results to everyone.
  const voted = p.myVote !== null || !!p.closed;
  const lead = Math.max(...p.options.map((o) => o.votes));
  const left = p.endsAt && !p.closed ? timeLeft(p.endsAt) : null;
  return (
    <View style={styles.poll}>
      <Text style={styles.pollEyebrow}>
        POLL · {p.closed ? `FINAL · ${compact(p.totalVotes)} votes` : voted ? `${compact(p.totalVotes)} votes` : "tap to vote"}
        {left ? ` · ${left} left` : ""}
      </Text>
      <Text style={styles.pollQuestion}>{drop.body}</Text>
      {p.options.map((o) => {
        const pct = Math.round((o.votes / Math.max(1, p.totalVotes)) * 100);
        const mine = p.myVote === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => !voted && onVote(o.id)}
            disabled={voted}
            style={[styles.pollOption, { borderColor: mine ? stream.lime : "#2E2E35" }]}
            accessibilityLabel={`${o.label}${voted ? `, ${pct}%` : ""}`}
          >
            <PollFill pct={voted ? pct : 0} lead={voted && o.votes === lead} />
            <View style={styles.pollLabelRow}>
              <Text style={styles.pollLabel}>{o.label}</Text>
              {mine ? <CheckGlyph /> : null}
            </View>
            {voted ? <Text style={styles.pollPct}>{pct}%</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function PollFill({ pct, lead }: { pct: number; lead: boolean }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 600, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [pct, w]);
  return (
    <Animated.View
      style={[
        styles.pollFill,
        { backgroundColor: lead ? "rgba(200,241,105,0.22)" : stream.chip, width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) },
      ]}
    />
  );
}

/** The big red heart that pops over media on double-tap. */
function HeartBurst({ burstKey }: { burstKey: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!burstKey) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [burstKey, v]);
  if (!burstKey) return null;
  return (
    <View style={styles.burst} pointerEvents="none">
      <Animated.View
        style={{
          opacity: v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { scale: v.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 1], outputRange: [0, 1.25, 0.95, 1, 1.15] }) },
            { translateY: v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 0, -30] }) },
          ],
        }}
      >
        <HeartGlyph size={104} filled />
      </Animated.View>
    </View>
  );
}

/** Little pop when an action turns on (like / save). */
function Beat({ active, children }: { active: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active) return;
    Animated.sequence([
      Animated.timing(v, { toValue: 1.3, duration: 130, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 190, useNativeDriver: true }),
    ]).start();
  }, [active, v]);
  return <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  article: { paddingTop: 14, paddingBottom: 18, gap: 10, borderBottomWidth: 1, borderBottomColor: stream.divider },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 10 },
  headerText: { flex: 1, minWidth: 0, gap: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  handle: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  follow: { fontFamily: fonts.bodySemibold, fontSize: 13.5, paddingLeft: 2 },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  menuButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  menu: {
    position: "absolute",
    right: 12,
    top: 40,
    zIndex: 15,
    minWidth: 200,
    padding: 6,
    backgroundColor: stream.raised,
    borderWidth: 1,
    borderColor: stream.raisedBorder,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },
  menuItem: { height: 42, paddingHorizontal: 12, borderRadius: 10, justifyContent: "center" },
  menuText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: stream.ink },
  mediaFrame: { marginHorizontal: 10, borderRadius: 24, overflow: "hidden", backgroundColor: stream.card },
  photo: { width: "100%" },
  photoFailed: { alignItems: "center", justifyContent: "center" },
  photoFailedText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: stream.inkMuted },
  carousel: { aspectRatio: 4 / 5 },
  counter: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(12,12,14,0.78)",
    color: stream.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(245,243,239,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: { position: "absolute", left: 0, right: 0, bottom: 12, flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(245,243,239,0.5)" },
  dotActive: { width: 18, backgroundColor: stream.ink },
  take: { marginHorizontal: 10, borderRadius: 24, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, minHeight: 300, justifyContent: "space-between", gap: 20, overflow: "hidden" },
  takeEyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.8 },
  takeText: { fontFamily: fonts.display, fontSize: 31, lineHeight: 33, letterSpacing: -0.9 },
  takeTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(12,12,14,0.25)", overflow: "hidden", flexDirection: "row" },
  takeFill: { backgroundColor: stream.bg },
  stanceButton: { flex: 1, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stanceText: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  poll: { marginHorizontal: 10, borderRadius: 24, backgroundColor: stream.card, borderWidth: 1, borderColor: stream.cardBorder, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 8 },
  pollEyebrow: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: stream.lime },
  pollQuestion: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.5, color: stream.ink, marginTop: 4, marginBottom: 8 },
  pollOption: { height: 50, borderRadius: 14, borderWidth: 1.5, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  pollFill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  pollLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollLabel: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  pollPct: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  burst: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8 },
  action: { height: 40, paddingHorizontal: 8, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.ink },
  saveButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  caption: { paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: stream.ink },
  captionHandle: { fontFamily: fonts.bodySemibold },
  topComment: { marginTop: 2, marginHorizontal: 16, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  topBubble: {
    flexShrink: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: stream.raised,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    overflow: "hidden",
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 18,
    color: stream.ink,
  },
  topWho: { fontFamily: fonts.bodySemibold, color: stream.lime },
  viewAll: { alignSelf: "flex-start", marginLeft: 48 },
  viewAllText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: stream.inkMuted },
});
