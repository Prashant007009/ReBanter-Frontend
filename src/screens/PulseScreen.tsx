import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { setStatusBarStyle } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import dayjs from "@/lib/dayjs";
import { stream, fonts, TAB_BAR_CLEARANCE } from "@/theme/colors";
import { useToast } from "@/components/stream/Toast";
import { PulseCard, type CrewUi, type PulseItem } from "@/components/pulse/PulseCard";
import { getPulse, getPulseWeek, markAllRead, markRead } from "@/api/pulse";
import { acceptCrewRequest, skipCrewRequest } from "@/api/crew";
import { replyToDrop } from "@/api/drops";
import { createBanter } from "@/api/banters";
import { realtimeSocket } from "@/realtime/socket";
import type { Notification, PulseWeek } from "@/api/types";
import type { RootStackParamList, TabParamList } from "@/navigation/types";

type Filter = "all" | "cheers" | "crew" | "mentions";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["cheers", "Cheers"],
  ["crew", "Crew"],
  ["mentions", "Mentions"],
];
const SKIP_UNDO_MS = 5000;

const inFilter = (item: { type: Notification["type"] }, f: Filter) =>
  f === "all" ||
  (f === "cheers" && item.type === "CHEER") ||
  (f === "crew" && (item.type === "CREW_REQUEST" || item.type === "CREW_JOINED")) ||
  (f === "mentions" && (item.type === "MENTION" || item.type === "REPLY"));

/** Collapse cheers on the same drop (same day bucket) into one card; everything else stays one-per-notification. */
function toItems(list: Notification[]): PulseItem[] {
  const out: PulseItem[] = [];
  const cheerCards = new Map<string, PulseItem>();
  for (const n of list) {
    const bucket = dayjs(n.createdAt).isSame(dayjs(), "day") ? "today" : "earlier";
    if (n.type === "CHEER" && n.dropId) {
      const key = `cheer:${n.dropId}:${bucket}`;
      const card = cheerCards.get(key);
      if (card) {
        card.ids.push(n.id);
        if (n.actor && !card.actors.some((a) => a.id === n.actor!.id)) card.actors.push(n.actor);
        card.unread = card.unread || !n.read;
        continue;
      }
      const fresh: PulseItem = { key, ids: [n.id], type: n.type, actors: n.actor ? [n.actor] : [], createdAt: n.createdAt, unread: !n.read, drop: n.drop, reply: n.reply, crew: n.crew, dropId: n.dropId };
      cheerCards.set(key, fresh);
      out.push(fresh);
      continue;
    }
    out.push({ key: n.id, ids: [n.id], type: n.type, actors: n.actor ? [n.actor] : [], createdAt: n.createdAt, unread: !n.read, drop: n.drop, reply: n.reply, crew: n.crew, dropId: n.dropId });
  }
  return out;
}

/** Heartbeat-style line: a spike per day sized by that day's activity. */
function sparkPath(counts: number[]) {
  const max = Math.max(1, ...counts);
  const base = 34;
  const pts: string[] = ["M0 34"];
  counts.forEach((c, i) => {
    const cx = 12 + (i * 296) / 6;
    const h = c === 0 ? 0 : 6 + (c / max) * 22;
    pts.push(`L${(cx - 12).toFixed(1)} ${base}`, `L${(cx - 5).toFixed(1)} ${(base - h).toFixed(1)}`, `L${(cx + 1).toFixed(1)} ${(base + h * 0.4).toFixed(1)}`, `L${(cx + 7).toFixed(1)} ${base}`);
  });
  pts.push("L320 34");
  return pts.join(" ");
}

function WeekCard({ week, unread }: { week: PulseWeek | null; unread: number }) {
  // Draw-in: drive the dash offset from an Animated value (animated SVG props leak
  // RN-only attributes onto the DOM on web).
  const draw = useRef(new Animated.Value(600)).current;
  const [offset, setOffset] = useState(600);
  useEffect(() => {
    const id = draw.addListener(({ value }) => setOffset(value));
    return () => draw.removeListener(id);
  }, [draw]);
  useEffect(() => {
    if (!week) return;
    draw.setValue(600);
    Animated.timing(draw, { toValue: 0, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
  }, [week, draw]);
  const counts = week?.days.map((d) => d.count) ?? [0, 0, 0, 0, 0, 0, 0];
  const labels = week ? week.days.map((d, i) => (i === 6 ? "TODAY" : dayjs(d.date).format("ddd").toUpperCase())) : ["", "", "", "", "", "", "TODAY"];

  return (
    <View style={styles.week}>
      <View style={styles.weekTop}>
        <View style={{ gap: 4 }}>
          <Text style={styles.eyebrow}>YOUR WEEK</Text>
          <Text style={styles.headline}>{unread ? `${unread} new ${unread > 1 ? "pings" : "ping"}` : "All caught up"}</Text>
        </View>
        <View style={styles.stats}>
          <Stat value={week?.cheers ?? 0} label="cheers" color="#FF7AB6" />
          <Stat value={week?.replies ?? 0} label="replies" color="#7B9CFF" />
          <Stat value={`+${week?.crew ?? 0}`} label="crew" color={stream.lime} />
        </View>
      </View>
      <Svg width="100%" height={48} viewBox="0 0 320 48" preserveAspectRatio="none">
        <Path d={sparkPath(counts)} fill="none" stroke={stream.lime} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="600" strokeDashoffset={offset} />
      </Svg>
      <View style={styles.days}>
        {labels.map((l, i) => (
          <Text key={i} style={[styles.day, i === 6 && { color: stream.lime }]}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Stat({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <View style={{ alignItems: "flex-end", gap: 2 }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function PulseScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList> & BottomTabNavigationProp<TabParamList>>();
  const toast = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [week, setWeek] = useState<PulseWeek | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [crewUi, setCrewUi] = useState<Record<string, CrewUi>>({});
  const [sent, setSent] = useState<Record<string, string>>({});
  const pendingSkips = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; userId: string }>());

  const load = useCallback(async () => {
    const [p, w] = await Promise.allSettled([getPulse(), getPulseWeek()]);
    if (p.status === "fulfilled") setNotifications(p.value.items);
    else setNotifications((prev) => prev ?? []);
    if (w.status === "fulfilled") setWeek(w.value);
    setIsRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      load();
      return () => setStatusBarStyle("dark");
    }, [load])
  );

  useEffect(() => {
    const off = realtimeSocket.on("notification.new", () => load());
    return () => {
      off();
    };
  }, [load]);

  // Tapping the Pulse tab again: back to All, back to the top.
  useEffect(
    () =>
      navigation.addListener("tabPress", () => {
        if (!navigation.isFocused()) return;
        setFilter("all");
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }),
    [navigation]
  );

  // Leaving with a skip still in its undo window: commit it now.
  useEffect(() => {
    const skips = pendingSkips.current;
    return () => {
      skips.forEach(({ timer, userId }) => {
        clearTimeout(timer);
        skipCrewRequest(userId).catch(() => {});
      });
      skips.clear();
    };
  }, []);

  const items = useMemo(() => toItems(notifications ?? []), [notifications]);
  const unreadIn = (f: Filter) => items.filter((i) => i.unread && inFilter(i, f)).length;
  const unread = unreadIn("all");
  const visible = items.filter((i) => inFilter(i, filter));
  const groups = [
    { label: "Today", items: visible.filter((i) => dayjs(i.createdAt).isSame(dayjs(), "day")) },
    { label: "Earlier", items: visible.filter((i) => !dayjs(i.createdAt).isSame(dayjs(), "day")) },
  ].filter((g) => g.items.length > 0);

  const setRead = useCallback((ids: string[]) => {
    setNotifications((prev) => prev && prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    markRead(ids).catch(() => {});
  }, []);

  const handlers = useRef({
    onOpen: (_: PulseItem) => {},
    onReply: async (_: PulseItem, __: string) => {},
    onLetIn: (_: PulseItem) => {},
    onSkip: (_: PulseItem) => {},
    onUndoSkip: (_: PulseItem) => {},
    onSayHi: (_: PulseItem) => {},
  });
  handlers.current = {
    onOpen(item) {
      if (item.unread) setRead(item.ids);
      if (item.dropId && item.type !== "CREW_REQUEST" && item.type !== "CREW_JOINED") navigation.navigate("Drop", { dropId: item.dropId });
      else if (item.actors[0] && item.type === "CREW_JOINED") navigation.navigate("UserProfile", { handle: item.actors[0].handle });
    },
    async onReply(item, text) {
      const who = item.actors[0]?.handle;
      if (!item.dropId) return;
      // Thread under their comment (or the drop itself for a caption/take mention), tagging them so they hear back.
      const parentId = item.reply ? item.reply.parentId ?? item.reply.id : undefined;
      const body = who && !text.includes(`@${who}`) ? `@${who} ${text}` : text;
      try {
        await replyToDrop(item.dropId, body, parentId);
        setSent((s) => ({ ...s, [item.key]: text }));
        if (item.unread) setRead(item.ids);
        toast("Reply sent");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't send that reply");
        throw err;
      }
    },
    async onLetIn(item) {
      const other = item.actors[0];
      if (!other) return;
      setCrewUi((c) => ({ ...c, [item.key]: "accepted" }));
      if (item.unread) setRead(item.ids);
      try {
        await acceptCrewRequest(other.id);
        toast(`${other.handle} joined your crew`);
      } catch (err) {
        setCrewUi((c) => ({ ...c, [item.key]: "pending" }));
        toast(err instanceof Error ? err.message : "Couldn't accept that request");
      }
    },
    onSkip(item) {
      const other = item.actors[0];
      if (!other) return;
      setCrewUi((c) => ({ ...c, [item.key]: "skipping" }));
      if (item.unread) setRead(item.ids);
      const timer = setTimeout(() => {
        pendingSkips.current.delete(item.key);
        setCrewUi((c) => ({ ...c, [item.key]: "skipped" }));
        skipCrewRequest(other.id).catch(() => {});
      }, SKIP_UNDO_MS);
      pendingSkips.current.set(item.key, { timer, userId: other.id });
    },
    onUndoSkip(item) {
      const pending = pendingSkips.current.get(item.key);
      if (pending) clearTimeout(pending.timer);
      pendingSkips.current.delete(item.key);
      setCrewUi((c) => ({ ...c, [item.key]: "pending" }));
    },
    async onSayHi(item) {
      const other = item.actors[0];
      if (!other) return;
      try {
        const banter = await createBanter(other.id);
        navigation.navigate("BanterThread", { banterId: banter.id, handle: other.handle });
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't open that chat");
      }
    },
  };
  const stable = useMemo(
    () => ({
      onOpen: (i: PulseItem) => handlers.current.onOpen(i),
      onReply: (i: PulseItem, t: string) => handlers.current.onReply(i, t),
      onLetIn: (i: PulseItem) => handlers.current.onLetIn(i),
      onSkip: (i: PulseItem) => handlers.current.onSkip(i),
      onUndoSkip: (i: PulseItem) => handlers.current.onUndoSkip(i),
      onSayHi: (i: PulseItem) => handlers.current.onSayHi(i),
    }),
    []
  );

  async function onMarkAll() {
    if (!unread) return;
    setNotifications((prev) => prev && prev.map((n) => ({ ...n, read: true })));
    toast("All caught up");
    markAllRead().catch(() => load());
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + 6 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              load();
            }}
            tintColor={stream.inkMuted}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            Pulse<Text style={{ color: stream.lime }}>.</Text>
          </Text>
          <Pressable
            onPress={onMarkAll}
            style={[styles.markAll, { borderColor: unread ? "#34402A" : "#222228" }]}
            accessibilityLabel={unread ? "Mark all read" : "All read"}
          >
            <Svg width={15} height={15} viewBox="0 0 28 20" fill="none" stroke={unread ? stream.lime : stream.inkFaint} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M2 10.5l4.5 4.5L16 5" />
              <Path d="M12 14l1 1L22.5 5" />
            </Svg>
            <Text style={[styles.markAllText, { color: unread ? stream.lime : stream.inkFaint }]}>{unread ? "Mark all read" : "All read"}</Text>
          </Pressable>
        </View>

        <WeekCard week={week} unread={unread} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([id, label]) => {
            const on = filter === id;
            const c = unreadIn(id);
            return (
              <Pressable
                key={id}
                onPress={() => setFilter(id)}
                style={[styles.filter, { backgroundColor: on ? stream.ink : "transparent", borderColor: on ? stream.ink : stream.raisedBorder }]}
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${label}${c ? `, ${c} unread` : ""}`}
              >
                <Text style={[styles.filterText, { color: on ? stream.bg : stream.inkSoft }]}>{label}</Text>
                {c > 0 ? <Text style={[styles.count, { backgroundColor: on ? stream.bg : stream.lime, color: on ? stream.lime : stream.onLime }]}>{c}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {notifications === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={stream.lime} />
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={stream.lime} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M2.5 12h4l2.5-6 4.5 12 2.5-6h5.5" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>Quiet on this frequency</Text>
            <Text style={styles.emptySub}>When someone banters back, you'll feel it here.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.label} style={{ paddingTop: 14 }}>
              <View style={styles.groupHead}>
                <Text style={styles.groupLabel}>{g.label.toUpperCase()}</Text>
                <View style={styles.groupRule} />
              </View>
              <View style={styles.cards}>
                {g.items.map((item) => (
                  <PulseCard key={item.key} item={item} crewUi={crewUi[item.key]} sentReply={sent[item.key]} {...stable} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, marginTop: 48, paddingHorizontal: 16 },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -1.2, color: stream.ink },
  markAll: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  markAllText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  week: { marginTop: 14, marginHorizontal: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderRadius: 24, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24", gap: 10, overflow: "hidden" },
  weekTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  eyebrow: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: stream.inkMuted },
  headline: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.8, color: stream.ink },
  stats: { flexDirection: "row", gap: 14 },
  statValue: { fontFamily: fonts.display, fontSize: 18 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: stream.inkMuted },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { fontFamily: fonts.bodySemibold, fontSize: 10.5, letterSpacing: 0.4, color: "#6F6D77" },
  filters: { gap: 6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  filter: { flexDirection: "row", alignItems: "center", gap: 7, height: 34, paddingLeft: 14, paddingRight: 12, borderWidth: 1, borderRadius: 999 },
  filterText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  count: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, overflow: "hidden", fontFamily: fonts.bodyBold, fontSize: 10.5, lineHeight: 18, textAlign: "center" },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  groupLabel: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.6, color: stream.inkMuted },
  groupRule: { flex: 1, height: 1, backgroundColor: "#1C1C21" },
  cards: { gap: 6, paddingHorizontal: 10 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 56, paddingHorizontal: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: stream.sheet, borderWidth: 1, borderColor: stream.cardBorder, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: stream.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 13.5, color: stream.inkMuted, textAlign: "center" },
});
