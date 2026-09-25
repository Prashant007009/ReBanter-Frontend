import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { setStatusBarStyle } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import QRCode from "react-native-qrcode-svg";
import { stream, fonts, TAB_BAR_CLEARANCE } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/stream/Toast";
import { ShareSheet } from "@/components/stream/ShareSheet";
import { takeTheme } from "@/components/stream/format";
import { profileCode } from "@/components/roam/ScanSheet";
import { DropViewer, ZapGlyph } from "@/components/me/DropViewer";
import { CrewSheet, EditProfileSheet, MenuSheet, NewPinSheet, ShareCardSheet, type EditDraft } from "@/components/me/MeSheets";
import { useSession } from "@/session/SessionContext";
import { getItem, setItem } from "@/session/tokenStore";
import { uploadLocalAsset } from "@/api/media";
import { reactToDrop, unreactToDrop } from "@/api/drops";
import { createBanter } from "@/api/banters";
import {
  addPin,
  deleteDrop,
  getInsights,
  getMyCrewWithSince,
  getPins,
  getUserDrops,
  getUserLoops,
  pinDrop,
  removePin,
  updateMe,
  type Insights,
  type ProfilePin,
  type UserLoop,
} from "@/api/me";
import type { StreamDrop, UserSummary } from "@/api/types";
import type { RootStackParamList, TabParamList } from "@/navigation/types";

type MyDrop = StreamDrop & { pinnedAt?: string | null };
type Tab = "drops" | "sounds" | "places" | "clips";
const TABS: [Tab, string][] = [
  ["drops", "Drops"],
  ["sounds", "Sounds"],
  ["places", "Places"],
  ["clips", "Clips"],
];
const VIBES: [string, string][] = [
  ["🛠️", "Building things"],
  ["🚗", "Car spotting"],
  ["🏔️", "On a road trip"],
  ["🎧", "Deep focus"],
  ["💬", "Open to banter"],
  ["🌙", "Do not disturb"],
];
const EMPTY: Record<Exclude<Tab, "drops">, [string, string, string, string]> = {
  sounds: ["🎙️", "Your sound wall is quiet", "Loops with a soundtrack you post in rooms live here.", "Find a room"],
  places: ["📍", "No places pinned", "Tag a spot on a drop and it lands here.", "Drop from a place"],
  clips: ["🎬", "No clips yet", "Loops and videos you post show up here.", "Post a drop"],
};
const HEADER_H = 52;
const TOP_INSET = 44;
const COVER_H = 178 + TOP_INSET;

// ---- small pieces ------------------------------------------------------------

/** Two lime arcs slowly orbiting the avatar. */
function SpinRing({ size }: { size: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stream.lime} strokeWidth={4} strokeDasharray={`${c * 0.41} ${c * 0.03} ${c * 0.53} ${c * 0.03}`} />
      </Svg>
    </Animated.View>
  );
}

function FlipAvatar({ user, flipped, onPress }: { user: { handle: string; displayName: string; avatarUrl: string | null }; flipped: boolean; onPress: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: flipped ? 1 : 0, friction: 7, tension: 60, useNativeDriver: true }).start();
  }, [flipped, v]);
  const front = v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const back = v.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  return (
    <Pressable onPress={onPress} style={styles.avatarWrap} accessibilityLabel={flipped ? "Show photo" : "Show my code"}>
      <SpinRing size={120} />
      <View style={styles.avatarInner}>
        <Animated.View style={[styles.face, { transform: [{ perspective: 700 }, { rotateY: front }] }]}>
          <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={104} radius={32} />
        </Animated.View>
        <Animated.View style={[styles.face, styles.faceBack, { transform: [{ perspective: 700 }, { rotateY: back }] }]}>
          <View style={styles.qrTile}>
            <QRCode value={profileCode(user.handle)} size={66} color={stream.lime} backgroundColor={stream.bg} />
          </View>
        </Animated.View>
      </View>
      <View style={styles.flipBadge} pointerEvents="none">
        <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={stream.bg} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
          <Path d="M18 3v4h-4M6 21v-4h4" />
        </Svg>
      </View>
    </Pressable>
  );
}

function Confetti({ burst }: { burst: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!burst) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [burst, v]);
  if (!burst) return null;
  const colors = [stream.lime, "#FF7AB6", "#7B9CFF", "#FFB020"];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 18 }, (_, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: `${i * 5.6 + 2}%`,
            top: -6,
            width: 7,
            height: 11,
            borderRadius: 2,
            backgroundColor: colors[i % 4],
            opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 60 + (i % 5) * 14] }) },
              { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${160 + i * 12}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ---- screen --------------------------------------------------------------------

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList> & BottomTabNavigationProp<TabParamList>>();
  const { user, refreshMe, logOut } = useSession();
  const toast = useToast();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollViewRef>(null);

  const [drops, setDrops] = useState<MyDrop[] | null>(null);
  const [loops, setLoops] = useState<UserLoop[]>([]);
  const [pins, setPins] = useState<ProfilePin[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [crew, setCrew] = useState<(UserSummary & { since: string })[] | null>(null);

  const [tab, setTab] = useState<Tab>("drops");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [flipped, setFlipped] = useState(false);
  const [vibesOpen, setVibesOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [insightDay, setInsightDay] = useState(6);
  const [setupHidden, setSetupHidden] = useState(true);
  const [confetti, setConfetti] = useState(0);
  const [pinFilter, setPinFilter] = useState<string | null>(null);
  const [placeFilter, setPlaceFilter] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"edit" | "share" | "menu" | "crew" | "pin" | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [shareDrop, setShareDrop] = useState<StreamDrop | null>(null);
  const [tabsY, setTabsY] = useState(0);
  const count = useRef(new Animated.Value(0)).current;
  const [countP, setCountP] = useState(0);
  const prevDone = useRef<number | null>(null);

  const setupKey = user ? `rebanter.setupHidden.${user.id}` : null;

  const load = useCallback(async () => {
    if (!user) return;
    refreshMe().catch(() => {});
    const [d, l, p, ins] = await Promise.allSettled([getUserDrops(user.handle), getUserLoops(user.handle), getPins(), getInsights()]);
    if (d.status === "fulfilled") setDrops(d.value.items);
    else setDrops((prev) => prev ?? []);
    if (l.status === "fulfilled") setLoops(l.value.items);
    if (p.status === "fulfilled") setPins(p.value.items);
    if (ins.status === "fulfilled") setInsights(ins.value);
  }, [user?.handle]);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      load();
      return () => setStatusBarStyle("dark");
    }, [load])
  );

  useEffect(() => {
    if (!setupKey) return;
    getItem(setupKey)
      .then((v) => setSetupHidden(v === "1"))
      .catch(() => setSetupHidden(false));
  }, [setupKey]);

  // Stats count up once the numbers arrive.
  useEffect(() => {
    const id = count.addListener(({ value }) => setCountP(value));
    return () => count.removeListener(id);
  }, [count]);
  useEffect(() => {
    if (drops === null) return;
    Animated.timing(count, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [drops === null, count]);

  // Tapping Me again scrolls back to the top.
  useEffect(
    () =>
      navigation.addListener("tabPress", () => {
        if (navigation.isFocused()) scrollRef.current?.scrollTo({ y: 0, animated: true });
      }),
    [navigation]
  );

  // ---- derived -------------------------------------------------------------------
  const tasks = useMemo(
    () =>
      user
        ? [
            { key: "cover", icon: "🖼️", label: "Add a cover", done: !!user.coverUrl },
            { key: "avatar", icon: "🙂", label: "Add a photo", done: !!user.avatarUrl },
            { key: "bio", icon: "✍️", label: "Write a bio", done: !!user.bio?.trim() },
            { key: "drop", icon: "⚡", label: "Post a drop", done: (drops?.length ?? user.stats.drops) > 0 },
            { key: "room", icon: "🎙️", label: "Join a room", done: user.hasJoinedRoom },
          ]
        : [],
    [user, drops]
  );
  const doneN = tasks.filter((t) => t.done).length;
  useEffect(() => {
    if (!tasks.length || drops === null) return;
    if (prevDone.current !== null && prevDone.current < tasks.length && doneN === tasks.length) {
      setConfetti((c) => c + 1);
      toast("Profile complete 🎉");
    }
    prevDone.current = doneN;
  }, [doneN, tasks.length, drops, toast]);

  const places = useMemo(() => {
    const m = new Map<string, MyDrop[]>();
    for (const d of drops ?? []) if (d.location) m.set(d.location, [...(m.get(d.location) ?? []), d]);
    return [...m.entries()].map(([place, list]) => ({ place, list }));
  }, [drops]);

  const gridDrops = useMemo(() => {
    const list = drops ?? [];
    if (!pinFilter) return list;
    const tag = `#${pinFilter.toLowerCase().replace(/\s+/g, "")}`;
    return list.filter((d) => `${d.caption ?? ""} ${d.body ?? ""}`.toLowerCase().includes(tag));
  }, [drops, pinFilter]);

  const sounds = loops.filter((l) => l.audioLabel);
  const clips = loops;

  if (!user) return null;
  const [vibeEmoji, ...vibeRest] = (user.vibe ?? "").split(" ");
  const vibeLabel = user.vibe ? vibeRest.join(" ") : "Set a vibe";

  // ---- actions -----------------------------------------------------------------------
  async function pickAndSet(field: "avatarUrl" | "coverUrl") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast("Photo access is needed");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: true, aspect: field === "avatarUrl" ? [1, 1] : [16, 9] });
    if (res.canceled) return;
    try {
      toast(field === "avatarUrl" ? "Uploading photo…" : "Uploading cover…");
      const url = await uploadLocalAsset(res.assets[0].uri, res.assets[0].mimeType ?? "image/jpeg");
      await updateMe({ [field]: url });
      await refreshMe();
      toast(field === "avatarUrl" ? "Photo updated" : "Cover updated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function setVibe(v: string | null) {
    setVibesOpen(false);
    try {
      await updateMe({ vibe: v });
      await refreshMe();
      toast(v ? `Vibe set: ${v}` : "Vibe cleared");
    } catch {
      toast("Couldn't set your vibe");
    }
  }

  async function copyLink() {
    await Clipboard.setStringAsync(`https://rebanter.app/${user!.handle}`).catch(() => {});
    toast(`rebanter.app/${user!.handle} copied`);
  }

  function doTask(key: string) {
    if (key === "cover") pickAndSet("coverUrl");
    else if (key === "avatar") pickAndSet("avatarUrl");
    else if (key === "bio") setSheet("edit");
    else if (key === "drop") navigation.navigate("NewDrop");
    else if (key === "room") navigation.navigate("Tabs", { screen: "Roam" });
  }

  function hideSetup() {
    setSetupHidden(true);
    if (setupKey) setItem(setupKey, "1").catch(() => {});
  }

  async function saveEdit(draft: EditDraft) {
    try {
      await updateMe({ displayName: draft.displayName, handle: draft.handle, bio: draft.bio || null });
      await refreshMe();
      setSheet(null);
      toast("Profile updated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save your profile");
      throw err;
    }
  }

  function spark(drop: StreamDrop) {
    const liked = !drop.likedByMe;
    const patch = (d: MyDrop) => (d.id === drop.id ? { ...d, likedByMe: liked, counts: { ...d.counts, likes: d.counts.likes + (liked ? 1 : -1) } } : d);
    setDrops((prev) => prev && prev.map(patch));
    (liked ? reactToDrop(drop.id, "cheer") : unreactToDrop(drop.id, "cheer")).catch(() => load());
  }

  async function togglePin(drop: MyDrop) {
    const pinned = !drop.pinnedAt;
    setDrops((prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();
      const next = prev.map((d) => ({ ...d, pinnedAt: d.id === drop.id ? (pinned ? now : null) : pinned ? null : d.pinnedAt }));
      return pinned ? [next.find((d) => d.id === drop.id)!, ...next.filter((d) => d.id !== drop.id)] : next;
    });
    setViewer(0);
    if (!pinned) setViewer(null);
    toast(pinned ? "Pinned to the top of your profile" : "Unpinned");
    pinDrop(drop.id, pinned).catch(() => load());
  }

  async function removeDrop(drop: StreamDrop) {
    setViewer(null);
    setDrops((prev) => prev && prev.filter((d) => d.id !== drop.id));
    try {
      await deleteDrop(drop.id);
      toast("Drop deleted");
      refreshMe().catch(() => {});
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete that drop");
      load();
    }
  }

  async function openCrew() {
    setSheet("crew");
    setCrew(null);
    getMyCrewWithSince()
      .then((r) => setCrew(r.items))
      .catch(() => setCrew([]));
  }

  async function messageUser(u: UserSummary) {
    try {
      const banter = await createBanter(u.id);
      setSheet(null);
      navigation.navigate("BanterThread", { banterId: banter.id, handle: u.handle });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't open that chat");
    }
  }

  // ---- header + parallax -------------------------------------------------------------
  const headerA = scrollY.interpolate({ inputRange: [150, 210], outputRange: [0, 1], extrapolate: "clamp" });
  const headerY = scrollY.interpolate({ inputRange: [150, 210], outputRange: [8, 0], extrapolate: "clamp" });
  const coverY = scrollY.interpolate({ inputRange: [-200, 0, 180, 400], outputRange: [-100, 0, 81, 81], extrapolate: "clamp" });
  const coverScale = scrollY.interpolate({ inputRange: [-200, 0], outputRange: [1.6, 1], extrapolate: "clamp" });
  const floatingTabs = scrollY.interpolate({ inputRange: [tabsY - TOP_INSET - HEADER_H - 1, tabsY - TOP_INSET - HEADER_H], outputRange: [0, 1], extrapolate: "clamp" });

  const stats = [
    { n: user.stats.drops, label: "Drops", on: () => { setTab("drops"); scrollRef.current?.scrollTo({ y: Math.max(0, tabsY - TOP_INSET - HEADER_H), animated: true }); } },
    { n: user.stats.crew, label: "Crew", on: openCrew },
    { n: user.stats.visits, label: "Visits", on: () => setShowInsights((s) => !s) },
  ];
  const maxVisit = Math.max(1, ...(insights?.days.map((d) => d.count) ?? [1]));

  const tabBar = (
    <View style={styles.tabRow}>
      <SlidingTabs tab={tab} onTab={(t) => { setTab(t); setPlaceFilter(null); }} dropsCount={drops?.length ?? 0} />
      {tab === "drops" ? (
        <Pressable style={styles.layoutButton} onPress={() => setLayout((l) => (l === "grid" ? "list" : "grid"))} accessibilityLabel={layout === "grid" ? "List view" : "Grid view"}>
          {layout === "grid" ? (
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={stream.ink} strokeWidth={2.2} strokeLinecap="round">
              <Rect x="4" y="4" width="16" height="7" rx="2" />
              <Rect x="4" y="14" width="16" height="6" rx="2" />
            </Svg>
          ) : (
            <Svg width={18} height={18} viewBox="0 0 24 24" fill={stream.ink}>
              <Rect x="3.5" y="3.5" width="7" height="7" rx="2" />
              <Rect x="13.5" y="3.5" width="7" height="7" rx="2" />
              <Rect x="3.5" y="13.5" width="7" height="7" rx="2" />
              <Rect x="13.5" y="13.5" width="7" height="7" rx="2" />
            </Svg>
          )}
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef as never}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + 6 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover with parallax */}
        <View style={styles.cover}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: coverY }, { scale: coverScale }] }]}>
            {user.coverUrl ? (
              <Image source={{ uri: user.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Pressable style={styles.coverEmpty} onPress={() => pickAndSet("coverUrl")}>
                <Text style={styles.coverEmptyText}>🖼️ Add a cover</Text>
              </Pressable>
            )}
          </Animated.View>
          <View style={styles.coverFade} pointerEvents="none" />
        </View>

        <View style={styles.body}>
          <View style={styles.idRow}>
            <FlipAvatar user={user} flipped={flipped} onPress={() => setFlipped((f) => !f)} />
            <View style={styles.idButtons}>
              <Pressable
                style={[styles.insightsButton, showInsights && { backgroundColor: stream.ink, borderColor: stream.ink }]}
                onPress={() => setShowInsights((s) => !s)}
                accessibilityLabel="Profile insights"
              >
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={showInsights ? stream.bg : stream.ink} strokeWidth={2.2} strokeLinecap="round">
                  <Path d="M5 20V12M10 20V6M15 20v-9M20 20V4" />
                </Svg>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.editButton, pressed && { transform: [{ scale: 0.96 }] }]} onPress={() => setSheet("edit")}>
                <Text style={styles.editText}>Edit profile</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.displayName}</Text>
              <Text style={styles.handle}>@{user.handle}</Text>
            </View>
            {user.bio ? (
              <Text style={styles.bio}>{user.bio}</Text>
            ) : (
              <Pressable onPress={() => setSheet("edit")}>
                <Text style={[styles.bio, { color: stream.inkFaint }]}>Add a bio so people know what you're about.</Text>
              </Pressable>
            )}
            <View style={styles.metaRow}>
              <Pressable style={[styles.vibePill, { borderColor: vibesOpen ? stream.lime : stream.raisedHover }]} onPress={() => setVibesOpen((o) => !o)} accessibilityLabel="Change vibe">
                <Text style={{ fontSize: 14 }}>{user.vibe ? vibeEmoji : "✨"}</Text>
                <Text style={styles.vibeText}>{vibeLabel}</Text>
                <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={stream.inkMuted} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: vibesOpen ? "180deg" : "0deg" }] }}>
                  <Path d="M6 9l6 6 6-6" />
                </Svg>
              </Pressable>
              <Pressable style={styles.linkPill} onPress={copyLink} accessibilityLabel="Copy profile link">
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={stream.lime} strokeWidth={2.4} strokeLinecap="round">
                  <Path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
                  <Path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
                </Svg>
                <Text style={styles.linkText}>rebanter.app/{user.handle}</Text>
              </Pressable>
            </View>
            {vibesOpen ? (
              <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vibes} style={{ marginHorizontal: -16 }}>
                {VIBES.map(([e, label]) => {
                  const value = `${e} ${label}`;
                  const on = user.vibe === value;
                  return (
                    <Pressable key={label} onPress={() => setVibe(on ? null : value)} style={[styles.vibeChip, { backgroundColor: on ? stream.lime : "transparent", borderColor: on ? stream.lime : stream.raisedBorder }]}>
                      <Text style={{ fontSize: 15 }}>{e}</Text>
                      <Text style={[styles.vibeChipText, { color: on ? stream.onLime : stream.inkSoft }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </Animated.ScrollView>
            ) : null}
          </View>

          <View style={styles.stats}>
            {stats.map((s, i) => (
              <Pressable key={s.label} onPress={s.on} style={({ pressed }) => [styles.stat, i > 0 && styles.statSep, pressed && { backgroundColor: stream.card }]} accessibilityLabel={`${s.n} ${s.label}`}>
                <Text style={styles.statN}>{Math.round(s.n * countP)}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {showInsights ? (
            <View style={styles.card}>
              <View style={styles.insightsTop}>
                <View style={{ gap: 3 }}>
                  <Text style={styles.eyebrow}>
                    PROFILE VISITS · {insights ? (insightDay === 6 ? "TODAY" : new Date(insights.days[insightDay].date).toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()) : ""}
                  </Text>
                  <Text style={styles.insightsValue}>{insights?.days[insightDay]?.count ?? 0}</Text>
                </View>
                {insights?.changePct !== null && insights?.changePct !== undefined ? (
                  <Text style={[styles.change, insights.changePct < 0 && { color: stream.redSoft, backgroundColor: "rgba(255,107,107,0.12)" }]}>
                    {insights.changePct >= 0 ? "↑" : "↓"} {Math.abs(insights.changePct)}% wk
                  </Text>
                ) : (
                  <Text style={styles.change}>{insights?.total ?? 0} this week</Text>
                )}
              </View>
              <View style={styles.bars}>
                {(insights?.days ?? Array.from({ length: 7 }, () => ({ date: "", count: 0 }))).map((d, i) => (
                  <Pressable key={i} style={styles.barCol} onPress={() => setInsightDay(i)} accessibilityLabel={`${d.count} visits`}>
                    <View style={[styles.bar, { height: Math.round((d.count / maxVisit) * 62 * countP + 4), backgroundColor: i === insightDay ? stream.lime : stream.raisedHover }]} />
                    <Text style={[styles.barDay, { color: i === insightDay ? stream.lime : stream.inkFaint }]}>{d.date ? new Date(d.date).toLocaleDateString("en-US", { weekday: "narrow" }) : ""}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {!setupHidden ? (
            <View style={[styles.card, { padding: 14, gap: 10, overflow: "hidden" }]}>
              <View style={styles.setupTop}>
                <View style={{ width: 46, height: 46 }}>
                  <Svg width={46} height={46} viewBox="0 0 46 46">
                    <Circle cx={23} cy={23} r={19} fill="none" stroke={stream.raisedHover} strokeWidth={5} />
                    <Circle cx={23} cy={23} r={19} fill="none" stroke={stream.lime} strokeWidth={5} strokeLinecap="round" strokeDasharray="119.4" strokeDashoffset={119.4 * (1 - doneN / tasks.length)} transform="rotate(-90 23 23)" />
                  </Svg>
                  <Text style={styles.setupPct}>{Math.round((doneN / tasks.length) * 100)}%</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.setupTitle}>{doneN === tasks.length ? "You're all set" : "Finish your profile"}</Text>
                  <Text style={styles.setupSub}>{doneN === tasks.length ? "Nice — your profile is complete." : `${tasks.length - doneN} steps to go · tap to complete`}</Text>
                </View>
                <Pressable style={styles.setupClose} onPress={hideSetup} accessibilityLabel="Hide setup">
                  <Text style={{ color: stream.inkFaint, fontSize: 14 }}>✕</Text>
                </Pressable>
              </View>
              <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}>
                {tasks.map((t) => (
                  <Pressable
                    key={t.key}
                    onPress={() => !t.done && doTask(t.key)}
                    style={[styles.task, t.done && { backgroundColor: "rgba(200,241,105,0.1)", borderColor: "rgba(200,241,105,0.35)" }]}
                    accessibilityLabel={`${t.label}${t.done ? " (done)" : ""}`}
                  >
                    <View style={[styles.taskIcon, t.done && { backgroundColor: stream.lime }]}>
                      <Text style={{ fontSize: 14, color: stream.onLime }}>{t.done ? "✓" : t.icon}</Text>
                    </View>
                    <Text style={[styles.taskLabel, t.done && { color: stream.lime, textDecorationLine: "line-through" }]}>{t.label}</Text>
                  </Pressable>
                ))}
              </Animated.ScrollView>
              <Confetti burst={confetti} />
            </View>
          ) : null}

          <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={styles.pins}>
            <Pressable style={styles.pinItem} onPress={() => setSheet("pin")} accessibilityLabel="New pin">
              <View style={styles.newPin}>
                <Text style={{ color: stream.lime, fontSize: 20 }}>+</Text>
              </View>
              <Text style={styles.pinLabel}>New pin</Text>
            </Pressable>
            {pins.map((p) => (
              <Pressable
                key={p.id}
                style={styles.pinItem}
                onPress={() => {
                  setPinFilter((f) => (f === p.label ? null : p.label));
                  setTab("drops");
                }}
                onLongPress={async () => {
                  setPins((prev) => prev.filter((x) => x.id !== p.id));
                  if (pinFilter === p.label) setPinFilter(null);
                  toast(`Removed pin “${p.label}”`);
                  removePin(p.id).catch(() => load());
                }}
                accessibilityLabel={`Pin ${p.label}`}
              >
                <View style={[styles.pinBubble, { backgroundColor: p.color, borderColor: pinFilter === p.label ? stream.lime : stream.ringSeen }]}>
                  <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                </View>
                <Text style={[styles.pinLabel, { color: pinFilter === p.label ? stream.lime : stream.ink }]} numberOfLines={1}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </Animated.ScrollView>
        </View>

        <View style={{ marginTop: 16 }} onLayout={(e: LayoutChangeEvent) => setTabsY(e.nativeEvent.layout.y)}>
          {tabBar}
        </View>

        {tab === "drops" ? (
          <>
            {pinFilter ? (
              <Pressable style={styles.filterChip} onPress={() => setPinFilter(null)}>
                <Text style={styles.filterChipText}>#{pinFilter} · {gridDrops.length} · ✕ clear</Text>
              </Pressable>
            ) : null}
            <DropGrid drops={gridDrops} layout={layout} onNew={() => navigation.navigate("NewDrop")} onOpen={(d) => setViewer((drops ?? []).indexOf(d))} loading={drops === null} />
          </>
        ) : tab === "places" && places.length > 0 ? (
          placeFilter ? (
            <>
              <Pressable style={styles.filterChip} onPress={() => setPlaceFilter(null)}>
                <Text style={styles.filterChipText}>← All places · 📍 {placeFilter}</Text>
              </Pressable>
              <DropGrid drops={places.find((p) => p.place === placeFilter)?.list ?? []} layout="grid" onOpen={(d) => setViewer((drops ?? []).indexOf(d))} loading={false} />
            </>
          ) : (
            <View style={{ paddingTop: 6 }}>
              {places.map((p) => (
                <Pressable key={p.place} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: "#131316" }]} onPress={() => setPlaceFilter(p.place)}>
                  <View style={styles.listGlyph}>
                    <Text style={{ fontSize: 20 }}>📍</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{p.place}</Text>
                    <Text style={styles.listSub}>
                      {p.list.length} drop{p.list.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        ) : tab === "sounds" && sounds.length > 0 ? (
          <View style={{ paddingTop: 6 }}>
            {sounds.map((l) => (
              <Pressable key={l.id} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: "#131316" }]} onPress={() => l.roomId && navigation.navigate("LoopsPlayer", { roomId: l.roomId, startLoopId: l.id })}>
                <View style={styles.listGlyph}>{l.coverUrl ? <Image source={{ uri: l.coverUrl }} style={StyleSheet.absoluteFill} /> : <Text style={{ fontSize: 20 }}>🎵</Text>}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{l.audioLabel}</Text>
                  <Text style={styles.listSub}>
                    {l.caption ?? "Loop"} · {Math.floor(l.durationSec / 60)}:{String(l.durationSec % 60).padStart(2, "0")}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : tab === "clips" && clips.length > 0 ? (
          <View style={styles.grid}>
            {clips.map((l) => (
              <Pressable key={l.id} style={[styles.tile, { width: "32.8%", height: 200 }]} onPress={() => l.roomId && navigation.navigate("LoopsPlayer", { roomId: l.roomId, startLoopId: l.id })}>
                {l.coverUrl ? <Image source={{ uri: l.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                <Text style={styles.clipDur}>▶ {Math.floor(l.durationSec / 60)}:{String(l.durationSec % 60).padStart(2, "0")}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36 }}>{EMPTY[tab][0]}</Text>
            <Text style={styles.emptyTitle}>{EMPTY[tab][1]}</Text>
            <Text style={styles.emptySub}>{EMPTY[tab][2]}</Text>
            <Pressable style={styles.emptyCta} onPress={() => (tab === "sounds" ? navigation.navigate("Tabs", { screen: "Roam" }) : navigation.navigate("NewDrop"))}>
              <Text style={styles.emptyCtaText}>{EMPTY[tab][3]}</Text>
            </Pressable>
          </View>
        )}
      </Animated.ScrollView>

      {/* Collapsing header */}
      <View style={styles.header}>
        {/* Solid backing fades in as the cover scrolls away (colour interpolation is unreliable on web). */}
        <Animated.View pointerEvents="none" style={[styles.headerBacking, { opacity: headerA }]} />
        <Animated.View style={[styles.headerId, { opacity: headerA, transform: [{ translateY: headerY }] }]}>
          <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={32} radius={11} />
          <View style={{ minWidth: 0 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {user.displayName}
            </Text>
            <Text style={styles.headerSub}>
              {user.stats.drops} drop{user.stats.drops === 1 ? "" : "s"}
            </Text>
          </View>
        </Animated.View>
        <Pressable style={styles.headerButton} onPress={() => setSheet("share")} accessibilityLabel="Share profile card">
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={stream.ink} strokeWidth={2} strokeLinecap="round">
            <Rect x="4" y="4" width="6" height="6" rx="1.5" />
            <Rect x="14" y="4" width="6" height="6" rx="1.5" />
            <Rect x="4" y="14" width="6" height="6" rx="1.5" />
            <Path d="M14 14h2v2M20 14v.01M14 20h.01M18 18h2v2" />
          </Svg>
        </Pressable>
        <Pressable style={styles.headerButton} onPress={() => setSheet("menu")} accessibilityLabel="Menu">
          <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={stream.ink} strokeWidth={2.2} strokeLinecap="round">
            <Path d="M4 7h16M4 12h16M4 17h10" />
          </Svg>
        </Pressable>
      </View>

      {/* Tabs pinned under the header once the real ones scroll past */}
      {tabsY > 0 ? (
        <Animated.View pointerEvents="box-none" style={[styles.floatingTabs, { opacity: floatingTabs }]}>
          <Animated.View pointerEvents="auto" style={{ transform: [{ translateY: floatingTabs.interpolate({ inputRange: [0, 1], outputRange: [-400, 0] }) }] }}>
            {tabBar}
          </Animated.View>
        </Animated.View>
      ) : null}

      <DropViewer
        drops={drops ?? []}
        index={viewer}
        onClose={() => setViewer(null)}
        onIndex={setViewer}
        onSpark={spark}
        onShare={(d) => setShareDrop(d)}
        onTogglePin={togglePin}
        onDelete={removeDrop}
      />
      <ShareSheet drop={shareDrop} onClose={() => setShareDrop(null)} onShared={() => {}} />
      <EditProfileSheet
        visible={sheet === "edit"}
        initial={{ displayName: user.displayName, handle: user.handle, bio: user.bio ?? "" }}
        onClose={() => setSheet(null)}
        onSave={saveEdit}
        onChangePhoto={() => pickAndSet("avatarUrl")}
        onChangeCover={() => pickAndSet("coverUrl")}
      />
      <ShareCardSheet visible={sheet === "share"} handle={user.handle} onClose={() => setSheet(null)} onDirect={() => { setSheet(null); navigation.navigate("Banters"); }} toast={toast} />
      <MenuSheet
        visible={sheet === "menu"}
        isPrivate={user.isPrivate}
        onClose={() => setSheet(null)}
        onSettings={() => { setSheet(null); navigation.navigate("Settings"); }}
        onSaved={() => { setSheet(null); navigation.navigate("Collection", { type: "save" }); }}
        onActivity={() => { setSheet(null); navigation.navigate("Collection", { type: "cheer" }); }}
        onTogglePrivate={async () => {
          try {
            await updateMe({ isPrivate: !user.isPrivate });
            await refreshMe();
            toast(!user.isPrivate ? "Profile is now private" : "Profile is now public");
          } catch {
            toast("Couldn't change that");
          }
        }}
        onLogOut={() => { setSheet(null); logOut(); }}
      />
      <CrewSheet visible={sheet === "crew"} crew={crew} onClose={() => setSheet(null)} onMessage={messageUser} onOpenProfile={(u) => { setSheet(null); navigation.navigate("UserProfile", { handle: u.handle }); }} />
      <NewPinSheet
        visible={sheet === "pin"}
        onClose={() => setSheet(null)}
        onCreate={async (p) => {
          try {
            const pin = await addPin(p);
            setPins((prev) => [...prev, pin]);
            setSheet(null);
            toast(`Pinned “${pin.label}”`);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Couldn't add that pin");
          }
        }}
      />
    </View>
  );
}

type ScrollViewRef = { scrollTo: (o: { y: number; animated?: boolean }) => void };

function SlidingTabs({ tab, onTab, dropsCount }: { tab: Tab; onTab: (t: Tab) => void; dropsCount: number }) {
  const [width, setWidth] = useState(0);
  const idx = TABS.findIndex(([id]) => id === tab);
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: idx, friction: 8, tension: 90, useNativeDriver: false }).start();
  }, [idx, x]);
  const seg = (width - 8) / TABS.length;
  return (
    <View style={styles.tabs} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? <Animated.View style={[styles.tabThumb, { width: seg, left: x.interpolate({ inputRange: [0, 3], outputRange: [4, 4 + seg * 3] }) }]} /> : null}
      {TABS.map(([id, label]) => (
        <Pressable key={id} style={styles.tabButton} onPress={() => onTab(id)} accessibilityState={{ selected: tab === id }} accessibilityLabel={label}>
          <Text style={[styles.tabText, { color: tab === id ? stream.bg : stream.inkMuted }]}>
            {label}
            {id === "drops" ? <Text style={{ fontSize: 10.5, opacity: 0.6 }}> {dropsCount}</Text> : null}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function DropGrid({ drops, layout, onNew, onOpen, loading }: { drops: MyDrop[]; layout: "grid" | "list"; onNew?: () => void; onOpen: (d: MyDrop) => void; loading: boolean }) {
  const tileStyle = layout === "grid" ? { width: "32.8%" as const, height: 160 } : { width: "100%" as const, height: 300 };
  return (
    <View style={styles.grid}>
      {onNew ? (
        <Pressable style={({ pressed }) => [styles.tile, styles.newTile, tileStyle, pressed && { backgroundColor: "#131316" }]} onPress={onNew} accessibilityLabel="New drop">
          <View style={styles.newTileIcon}>
            <Text style={{ color: stream.lime, fontSize: 20 }}>+</Text>
          </View>
          <Text style={styles.newTileText}>New drop</Text>
        </Pressable>
      ) : null}
      {loading ? <Text style={[styles.emptySub, { padding: 20 }]}>Loading your drops…</Text> : null}
      {drops.map((d) => {
        const theme = takeTheme(d.id);
        return (
          <Pressable key={d.id} style={[styles.tile, tileStyle, { backgroundColor: d.kind === "take" ? theme.bg : stream.card }]} onPress={() => onOpen(d)} accessibilityLabel={`Open drop${d.caption ? `: ${d.caption}` : ""}`}>
            {d.media[0] ? (
              <Image source={{ uri: d.media[0].url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Text style={[styles.tileText, { color: d.kind === "take" ? theme.ink : stream.ink }]} numberOfLines={layout === "grid" ? 5 : 6}>
                {d.kind === "poll" ? "📊 " : ""}
                {d.body}
              </Text>
            )}
            <View style={styles.tileShade} pointerEvents="none" />
            <View style={styles.sparks} pointerEvents="none">
              <ZapGlyph size={12} color={stream.lime} />
              <Text style={styles.sparksText}>{d.counts.likes}</Text>
            </View>
            {d.pinnedAt ? <Text style={styles.pinnedBadge}>📌 Pinned</Text> : null}
            <View style={styles.expand} pointerEvents="none">
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={stream.ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
              </Svg>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg },
  cover: { height: COVER_H, overflow: "hidden", backgroundColor: "#1A2226" },
  coverEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverEmptyText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.inkMuted, marginTop: TOP_INSET },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70, backgroundColor: "rgba(12,12,14,0.55)" },
  body: { paddingHorizontal: 16, marginTop: -58, gap: 14 },
  idRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  avatarWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  avatarInner: { width: 112, height: 112, borderRadius: 36, backgroundColor: stream.bg, alignItems: "center", justifyContent: "center" },
  face: { position: "absolute", width: 104, height: 104, borderRadius: 32, overflow: "hidden", backfaceVisibility: "hidden", alignItems: "center", justifyContent: "center" },
  faceBack: { backgroundColor: stream.lime },
  qrTile: { padding: 6, borderRadius: 14, backgroundColor: stream.bg },
  flipBadge: { position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: stream.ink, borderWidth: 3, borderColor: stream.bg, alignItems: "center", justifyContent: "center" },
  idButtons: { flexDirection: "row", gap: 6, paddingBottom: 6 },
  insightsButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: stream.raisedHover, backgroundColor: stream.sheet, alignItems: "center", justifyContent: "center" },
  editButton: { height: 42, paddingHorizontal: 16, borderRadius: 14, backgroundColor: stream.lime, justifyContent: "center" },
  editText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.onLime },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  name: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: stream.ink },
  handle: { fontFamily: fonts.body, fontSize: 14, color: stream.inkMuted },
  bio: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20, color: stream.inkSoft },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 },
  vibePill: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingLeft: 8, paddingRight: 12, borderWidth: 1, borderRadius: 999, backgroundColor: stream.sheet },
  vibeText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.ink },
  linkPill: { flexDirection: "row", alignItems: "center", gap: 5, height: 30, paddingHorizontal: 10 },
  linkText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.lime },
  vibes: { gap: 6, paddingHorizontal: 16, paddingTop: 4 },
  vibeChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingLeft: 10, paddingRight: 12, borderWidth: 1, borderRadius: 999 },
  vibeChipText: { fontFamily: fonts.bodySemibold, fontSize: 12.5 },
  stats: { flexDirection: "row", borderWidth: 1, borderColor: "#1F1F24", borderRadius: 20, backgroundColor: "#111114", overflow: "hidden" },
  stat: { flex: 1, alignItems: "center", gap: 4, paddingTop: 14, paddingBottom: 12 },
  statSep: { borderLeftWidth: 1, borderLeftColor: "#1F1F24" },
  statN: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.7, color: stream.ink },
  statLabel: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: stream.inkMuted },
  card: { padding: 16, borderRadius: 22, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24", gap: 12 },
  insightsTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  eyebrow: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: stream.inkMuted },
  insightsValue: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.9, color: stream.ink },
  change: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(200,241,105,0.12)", color: stream.lime, fontFamily: fonts.bodyBold, fontSize: 12 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 84 },
  barCol: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", gap: 6 },
  bar: { width: "100%", borderRadius: 8 },
  barDay: { fontFamily: fonts.bodySemibold, fontSize: 10.5 },
  setupTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  setupPct: { position: "absolute", left: 0, right: 0, top: 15, textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 12, color: stream.ink },
  setupTitle: { fontFamily: fonts.display, fontSize: 16, color: stream.ink },
  setupSub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  setupClose: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  task: { width: 118, height: 92, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: stream.raisedHover, backgroundColor: "#1A1A1F", justifyContent: "space-between" },
  taskIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: stream.raisedHover, alignItems: "center", justifyContent: "center" },
  taskLabel: { fontFamily: fonts.bodySemibold, fontSize: 12.5, lineHeight: 15.5, color: stream.ink },
  pins: { gap: 14, paddingHorizontal: 16, paddingVertical: 2 },
  pinItem: { width: 64, alignItems: "center", gap: 6 },
  newPin: { width: 60, height: 60, borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#3A3A42", alignItems: "center", justifyContent: "center" },
  pinBubble: { width: 60, height: 60, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pinLabel: { maxWidth: 64, fontFamily: fonts.bodyMedium, fontSize: 11.5, color: stream.inkMuted },
  tabRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(12,12,14,0.94)" },
  tabs: { flex: 1, flexDirection: "row", padding: 4, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24", borderRadius: 16 },
  tabThumb: { position: "absolute", top: 4, bottom: 4, borderRadius: 12, backgroundColor: stream.ink },
  tabButton: { flex: 1, height: 34, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: fonts.bodySemibold, fontSize: 12.5 },
  layoutButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: "#1F1F24", backgroundColor: stream.sheet, alignItems: "center", justifyContent: "center" },
  floatingTabs: { position: "absolute", left: 0, right: 0, top: TOP_INSET + HEADER_H, zIndex: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 4, paddingTop: 4 },
  tile: { borderRadius: 12, overflow: "hidden", justifyContent: "center" },
  newTile: { borderWidth: 1.5, borderStyle: "dashed", borderColor: stream.ringSeen, alignItems: "center", gap: 8 },
  newTileIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#18181C", alignItems: "center", justifyContent: "center" },
  newTileText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.inkMuted },
  tileText: { paddingHorizontal: 10, fontFamily: fonts.display, fontSize: 13, lineHeight: 15 },
  tileShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 54, backgroundColor: "rgba(0,0,0,0.35)" },
  sparks: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  sparksText: { fontFamily: fonts.bodyBold, fontSize: 12, color: stream.ink },
  pinnedBadge: { position: "absolute", left: 8, top: 8, paddingHorizontal: 7, height: 22, lineHeight: 22, borderRadius: 8, overflow: "hidden", backgroundColor: stream.lime, color: stream.onLime, fontFamily: fonts.bodyBold, fontSize: 10.5 },
  expand: { position: "absolute", right: 7, bottom: 7, width: 30, height: 30, borderRadius: 10, backgroundColor: "rgba(12,12,14,0.75)", alignItems: "center", justifyContent: "center" },
  clipDur: { position: "absolute", left: 8, top: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(12,12,14,0.8)", color: stream.ink, fontFamily: fonts.bodySemibold, fontSize: 11 },
  filterChip: { alignSelf: "flex-start", marginLeft: 12, marginTop: 6, paddingHorizontal: 12, height: 30, justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(200,241,105,0.12)" },
  filterChipText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.lime },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  listGlyph: { width: 46, height: 46, borderRadius: 15, backgroundColor: stream.raised, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  listTitle: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  listSub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  empty: { alignItems: "center", gap: 8, paddingVertical: 44, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 18, color: stream.ink, marginTop: 4 },
  emptySub: { fontFamily: fonts.body, fontSize: 13.5, color: stream.inkMuted, textAlign: "center" },
  emptyCta: { marginTop: 8, height: 40, paddingHorizontal: 18, borderRadius: 13, backgroundColor: stream.lime, justifyContent: "center" },
  emptyCtaText: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: stream.onLime },
  header: { position: "absolute", left: 0, right: 0, top: 0, paddingTop: TOP_INSET, height: TOP_INSET + HEADER_H, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: 10, zIndex: 20 },
  headerBacking: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: stream.bg, borderBottomWidth: 1, borderBottomColor: "#222228" },
  headerId: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  headerName: { fontFamily: fonts.display, fontSize: 15, color: stream.ink },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: stream.inkMuted },
  headerButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(12,12,14,0.55)", alignItems: "center", justifyContent: "center" },
});
