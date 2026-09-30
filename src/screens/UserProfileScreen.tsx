import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setStatusBarStyle } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import Svg, { Circle, Path } from "react-native-svg";
import { stream, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/stream/Toast";
import { BottomSheet } from "@/components/stream/BottomSheet";
import { ShareSheet } from "@/components/stream/ShareSheet";
import { MomentRing } from "@/components/stream/MomentRing";
import { MomentViewer } from "@/components/stream/MomentViewer";
import { ChevronGlyph } from "@/components/stream/StreamIcons";
import { takeTheme } from "@/components/stream/format";
import { shortAgo } from "@/components/pulse/PulseCard";
import { DropViewer, ZapGlyph } from "@/components/me/DropViewer";
import { ShareCardSheet, profileLink } from "@/components/me/MeSheets";
import { useSession } from "@/session/SessionContext";
import { realtimeSocket } from "@/realtime/socket";
import {
  getSimilarRoamers,
  getUserCrew,
  getUserProfile,
  reportUser,
  setProfileSwitch,
  type ProfileCrewMember,
  type ProfileSwitch,
  type ReportReason,
  type SimilarRoamer,
} from "@/api/users";
import { getUserDrops, getUserLoops, type UserLoop } from "@/api/me";
import { acceptCrewRequest, cancelCrewRequest, leaveCrew, sendCrewRequest, skipCrewRequest } from "@/api/crew";
import { createBanter } from "@/api/banters";
import { reactToDrop, unreactToDrop } from "@/api/drops";
import { getMoments } from "@/api/moments";
import type { MomentGroup, PublicUserProfile, StreamDrop, UserSummary } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

type Drop = StreamDrop & { pinnedAt?: string | null };
type Tab = "drops" | "sounds" | "places" | "clips";
const TABS: [Tab, string][] = [
  ["drops", "Drops"],
  ["sounds", "Sounds"],
  ["places", "Places"],
  ["clips", "Clips"],
];
const EMPTY: Record<Tab, [string, string]> = {
  drops: ["⚡", "No drops yet"],
  sounds: ["🎙️", "No sounds yet"],
  places: ["📍", "No places pinned"],
  clips: ["🎬", "No clips yet"],
};
const REPORT_REASONS: [ReportReason, string][] = [
  ["spam", "Spam or scam"],
  ["harassment", "Harassment or bullying"],
  ["impersonation", "Pretending to be someone"],
  ["inappropriate", "Inappropriate content"],
  ["underage", "May be under 13"],
  ["other", "Something else"],
];
const TINTS = ["#1C2430", "#1A2226", "#23301E", "#2A211C"];
const HEADER_H = 52;
const TOP_INSET = 44;
const COVER_H = 170 + TOP_INSET;
const DOUBLE_TAP_MS = 260;

type Props = NativeStackScreenProps<RootStackParamList, "UserProfile">;
type Sheet = "menu" | "crew" | "mutuals" | "share" | "block" | "report" | null;

/** Someone else's profile (Rebanter Profile design). */
export function UserProfileScreen({ route, navigation }: Props) {
  const { handle } = route.params;
  const { user: me } = useSession();
  const toast = useToast();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drops, setDrops] = useState<Drop[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [loops, setLoops] = useState<UserLoop[]>([]);
  const [moments, setMoments] = useState<MomentGroup[]>([]);
  const [momentOpen, setMomentOpen] = useState<number | null>(null);

  const [tab, setTab] = useState<Tab>("drops");
  const [tabsY, setTabsY] = useState(0);
  const [pinFilter, setPinFilter] = useState<string | null>(null);
  const [placeFilter, setPlaceFilter] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [shareDrop, setShareDrop] = useState<StreamDrop | null>(null);
  const [burst, setBurst] = useState<{ id: string; n: number } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [people, setPeople] = useState<ProfileCrewMember[] | null>(null);
  const [peopleLocked, setPeopleLocked] = useState(false);
  const [suggOpen, setSuggOpen] = useState(false);
  const [sugg, setSugg] = useState<SimilarRoamer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [bellN, setBellN] = useState(0);
  const lastTap = useRef<{ id: string; at: number; timer?: ReturnType<typeof setTimeout> }>({ id: "", at: 0 });
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const p = await getUserProfile(handle);
      setProfile(p);
      setError(null);
      if (p.relationship === "self") {
        navigation.navigate("Tabs", { screen: "Me" });
        return;
      }
      const [d, l, m] = await Promise.allSettled([getUserDrops(handle), getUserLoops(handle), getMoments()]);
      if (d.status === "fulfilled") {
        setDrops(d.value.items);
        setLocked(d.value.locked);
      } else setDrops((prev) => prev ?? []);
      if (l.status === "fulfilled") setLoops(l.value.items);
      if (m.status === "fulfilled") setMoments(m.value.items.filter((g) => g.author.id === p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this profile");
    }
  }, [handle, navigation]);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      load();
      return () => setStatusBarStyle("dark");
    }, [load])
  );

  // "Active now" follows live presence events (crew only; the server decides who may watch).
  useEffect(() => {
    if (!profile?.presence) return;
    const off = realtimeSocket.on("presence", (payload) => {
      const p = payload as { userId: string; online: boolean; lastSeenAt: string | null };
      if (p.userId === profile.id) setProfile((cur) => (cur ? { ...cur, presence: { online: p.online, lastSeenAt: p.lastSeenAt } } : cur));
    });
    return () => {
      off();
    };
  }, [profile?.id, !!profile?.presence]);

  useEffect(
    () => () => {
      clearTimeout(lastTap.current.timer);
      clearTimeout(leaveTimer.current);
    },
    []
  );

  // ---- derived --------------------------------------------------------------------
  const places = useMemo(() => {
    const m = new Map<string, Drop[]>();
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
  const moment = moments[0];
  const momentUnseen = !!moment && moment.frames.some((f) => !f.seen);

  // ---- actions ----------------------------------------------------------------------
  const patchProfile = (fn: (p: PublicUserProfile) => PublicUserProfile) => setProfile((p) => (p ? fn(p) : p));

  async function onCrew() {
    if (!profile || busy) return;
    const name = profile.handle;
    setBusy(true);
    try {
      if (profile.relationship === "none") {
        await sendCrewRequest(profile.id);
        const fresh = await getUserProfile(handle);
        setProfile(fresh);
        toast(fresh.relationship === "crew" ? `${name} is in your crew 🎉` : "Crew request sent");
        if (fresh.relationship === "crew") load();
      } else if (profile.relationship === "requested") {
        await cancelCrewRequest(profile.id);
        patchProfile((p) => ({ ...p, relationship: "none" }));
        toast("Request cancelled");
      } else if (profile.relationship === "incoming") {
        await acceptCrewRequest(profile.id);
        patchProfile((p) => ({ ...p, relationship: "crew", stats: { ...p.stats, crew: p.stats.crew + 1 } }));
        toast(`${name} is in your crew 🎉`);
        load();
      } else if (profile.relationship === "crew") {
        // Leaving takes a second tap so it can't happen by accident.
        if (!confirmLeave) {
          setConfirmLeave(true);
          clearTimeout(leaveTimer.current);
          leaveTimer.current = setTimeout(() => setConfirmLeave(false), 3000);
          return;
        }
        setConfirmLeave(false);
        await leaveCrew(profile.id);
        patchProfile((p) => ({ ...p, relationship: "none", presence: null, stats: { ...p.stats, crew: Math.max(0, p.stats.crew - 1) } }));
        toast("Left crew");
        load();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't do that");
    } finally {
      setBusy(false);
    }
  }

  async function skipRequest() {
    if (!profile) return;
    setSheet(null);
    try {
      await skipCrewRequest(profile.id);
      patchProfile((p) => ({ ...p, relationship: "none" }));
      toast("Request skipped");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't skip that request");
    }
  }

  async function message(u: Pick<UserSummary, "id" | "handle">) {
    try {
      const banter = await createBanter(u.id);
      setSheet(null);
      navigation.navigate("BanterThread", { banterId: banter.id, handle: u.handle });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't open that chat");
    }
  }

  async function toggle(kind: ProfileSwitch, key: keyof PublicUserProfile["viewer"], onMsg: string, offMsg: string) {
    if (!profile) return;
    const on = !profile.viewer[key];
    patchProfile((p) => ({ ...p, viewer: { ...p.viewer, [key]: on } }));
    try {
      await setProfileSwitch(profile.handle, kind, on);
      toast(on ? onMsg : offMsg);
    } catch (err) {
      patchProfile((p) => ({ ...p, viewer: { ...p.viewer, [key]: !on } }));
      toast(err instanceof Error ? err.message : "Couldn't change that");
    }
  }

  async function block(on: boolean) {
    if (!profile) return;
    setSheet(null);
    try {
      await setProfileSwitch(profile.handle, "block", on);
      toast(on ? `Blocked ${profile.handle}` : `Unblocked ${profile.handle}`);
      setSuggOpen(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't do that");
    }
  }

  async function report(reason: ReportReason) {
    if (!profile) return;
    setSheet(null);
    try {
      await reportUser(profile.handle, reason);
      toast("Thanks — we'll take a look");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send that report");
    }
  }

  function openPeople(kind: "crew" | "mutuals") {
    setSheet(kind);
    setPeople(null);
    getUserCrew(handle)
      .then((r) => {
        setPeople(r.items);
        setPeopleLocked(r.locked);
      })
      .catch(() => setPeople([]));
  }

  function toggleSugg() {
    setSuggOpen((o) => !o);
    if (sugg === null)
      getSimilarRoamers(handle)
        .then((r) => setSugg(r.items))
        .catch(() => setSugg([]));
  }

  async function suggCrew(s: SimilarRoamer) {
    const next = s.relationship === "requested" ? "none" : "requested";
    setSugg((list) => list && list.map((x) => (x.id === s.id ? { ...x, relationship: next } : x)));
    try {
      if (next === "requested") await sendCrewRequest(s.id);
      else await cancelCrewRequest(s.id);
    } catch (err) {
      setSugg((list) => list && list.map((x) => (x.id === s.id ? { ...x, relationship: s.relationship } : x)));
      toast(err instanceof Error ? err.message : "Couldn't do that");
    }
  }

  function spark(drop: StreamDrop, force = false) {
    if (force && drop.likedByMe) return;
    const liked = !drop.likedByMe;
    setDrops((prev) => prev && prev.map((d) => (d.id === drop.id ? { ...d, likedByMe: liked, counts: { ...d.counts, likes: d.counts.likes + (liked ? 1 : -1) } } : d)));
    (liked ? reactToDrop(drop.id, "cheer") : unreactToDrop(drop.id, "cheer")).catch(() => load());
  }

  // Tap opens the drop; a quick second tap sparks it instead.
  function onTile(d: Drop) {
    const now = Date.now();
    const t = lastTap.current;
    if (t.id === d.id && now - t.at < DOUBLE_TAP_MS) {
      clearTimeout(t.timer);
      lastTap.current = { id: "", at: 0 };
      spark(d, true);
      setBurst((b) => ({ id: d.id, n: (b?.n ?? 0) + 1 }));
      return;
    }
    clearTimeout(t.timer);
    lastTap.current = { id: d.id, at: now, timer: setTimeout(() => setViewer((drops ?? []).indexOf(d)), DOUBLE_TAP_MS) };
  }

  const scrollToTabs = () => scrollRef.current?.scrollTo({ y: Math.max(0, tabsY - TOP_INSET - HEADER_H), animated: true });

  // ---- header + parallax ---------------------------------------------------------------
  const headerA = scrollY.interpolate({ inputRange: [140, 200], outputRange: [0, 1], extrapolate: "clamp" });
  const coverY = scrollY.interpolate({ inputRange: [-200, 0, 170, 400], outputRange: [-100, 0, 76, 76], extrapolate: "clamp" });
  const coverScale = scrollY.interpolate({ inputRange: [-200, 0], outputRange: [1.6, 1], extrapolate: "clamp" });
  const floatingTabs = scrollY.interpolate({ inputRange: [tabsY - TOP_INSET - HEADER_H - 1, tabsY - TOP_INSET - HEADER_H], outputRange: [0, 1], extrapolate: "clamp" });

  const header = (
    <View style={styles.header}>
      <Animated.View pointerEvents="none" style={[styles.headerBacking, { opacity: headerA }]} />
      <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
        <ChevronGlyph direction="left" color={stream.ink} size={20} />
      </Pressable>
      <Animated.View style={{ flex: 1, minWidth: 0, opacity: headerA }}>
        <Text style={styles.headerName} numberOfLines={1}>
          {profile?.handle ?? handle}
        </Text>
        {profile ? (
          <Text style={styles.headerSub}>
            {profile.stats.drops} drop{profile.stats.drops === 1 ? "" : "s"}
          </Text>
        ) : null}
      </Animated.View>
      {profile && !profile.viewer.blocked ? (
        <Bell
          on={profile.viewer.alerts}
          beat={bellN}
          onPress={() => {
            setBellN((n) => n + 1);
            toggle("alerts", "alerts", "You'll be pinged when they drop", "Drop alerts off");
          }}
        />
      ) : null}
      {profile ? (
        <Pressable style={styles.headerButton} onPress={() => setSheet("menu")} accessibilityLabel="More">
          <Svg width={20} height={20} viewBox="0 0 24 24" fill={stream.ink}>
            <Circle cx={5.5} cy={12} r={1.7} />
            <Circle cx={12} cy={12} r={1.7} />
            <Circle cx={18.5} cy={12} r={1.7} />
          </Svg>
        </Pressable>
      ) : null}
    </View>
  );

  if (!profile) {
    return (
      <View style={styles.container}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{ marginTop: 140 }} color={stream.lime} />}
        {header}
      </View>
    );
  }

  const p = profile;
  const blocked = p.viewer.blocked;
  const crewUi = confirmLeave
    ? { label: "Tap again to leave crew", bg: "rgba(255,107,107,0.12)", fg: stream.redSoft, border: "rgba(255,107,107,0.45)" }
    : {
        none: { label: "+ Join crew", bg: stream.lime, fg: stream.onLime, border: stream.lime },
        requested: { label: "Requested · tap to cancel", bg: stream.sheet, fg: stream.inkMuted, border: "#2E2E35" },
        incoming: { label: "✓ Let them in", bg: stream.lime, fg: stream.onLime, border: stream.lime },
        crew: { label: "✓ In your crew", bg: "rgba(200,241,105,0.12)", fg: stream.lime, border: "rgba(200,241,105,0.4)" },
        self: { label: "Your profile", bg: stream.sheet, fg: stream.ink, border: "#2E2E35" },
      }[p.relationship];
  const [vibeEmoji, ...vibeRest] = (p.vibe ?? "").split(" ");
  const stats = [
    { n: p.stats.drops, label: "Drops", on: () => { setTab("drops"); scrollToTabs(); } },
    { n: p.stats.crew, label: "Crew", on: () => openPeople("crew") },
    { n: p.mutuals.count, label: "Mutuals", on: () => openPeople("mutuals") },
  ];
  const presenceText = p.presence ? (p.presence.online ? "Active now" : p.presence.lastSeenAt ? `Active ${shortAgo(p.presence.lastSeenAt)} ago` : null) : null;
  const tabBar = (
    <View style={styles.tabRow}>
      <SlidingTabs tab={tab} onTab={(t) => { setTab(t); setPlaceFilter(null); }} />
    </View>
  );
  const emptyFor = (t: Tab) => (
    <View style={styles.empty}>
      <Text style={{ fontSize: 36, lineHeight: 40 }}>{EMPTY[t][0]}</Text>
      <Text style={styles.emptyTitle}>{EMPTY[t][1]}</Text>
      <Text style={styles.emptySub}>{p.handle} hasn't shared any yet.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef as never}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cover}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: coverY }, { scale: coverScale }] }]}>
            {p.coverUrl && !blocked ? <Image source={{ uri: p.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          </Animated.View>
          <View style={styles.coverFade} pointerEvents="none" />
        </View>

        <View style={styles.body}>
          <View style={styles.idRow}>
            <Pressable
              onPress={() => (moment ? setMomentOpen(0) : undefined)}
              style={styles.avatarWrap}
              accessibilityLabel={moment ? `Open ${p.handle}'s moment` : `${p.handle}'s photo`}
              disabled={!moment}
            >
              <MomentRing size={116} radius={38} frames={moment && !blocked ? moment.frames.length : 0} seen={!momentUnseen} thickness={4}>
                <View style={styles.avatarInner}>
                  <Avatar handle={p.handle} displayName={p.displayName} avatarUrl={blocked ? null : p.avatarUrl} size={100} radius={30} />
                </View>
              </MomentRing>
              {momentUnseen && !blocked ? <Text style={styles.newMoment}>NEW MOMENT</Text> : null}
            </Pressable>
            {presenceText && !blocked ? <PresencePill online={!!p.presence?.online} text={presenceText} /> : null}
          </View>

          <View style={{ gap: 6 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{p.displayName}</Text>
              {p.relationship === "incoming" ? <Text style={styles.followsYou}>Requested you</Text> : null}
            </View>
            <Text style={styles.handle}>@{p.handle}</Text>
            {p.bio && !blocked ? <Text style={styles.bio}>{p.bio}</Text> : null}
            {!blocked && (p.vibe || p.place) ? (
              <View style={styles.chips}>
                {p.vibe ? (
                  <Text style={styles.chip}>
                    {vibeEmoji} {vibeRest.join(" ")}
                  </Text>
                ) : null}
                {p.place ? <Text style={styles.chip}>📍 {p.place}</Text> : null}
              </View>
            ) : null}
          </View>

          {blocked ? (
            <View style={styles.blockCard}>
              <Text style={styles.blockTitle}>You blocked {p.handle}</Text>
              <Text style={styles.blockSub}>They can't find your profile, see your drops or message you.</Text>
              <Pressable style={styles.unblock} onPress={() => block(false)} accessibilityLabel="Unblock">
                <Text style={styles.unblockText}>Unblock</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.stats}>
                {stats.map((s, i) => (
                  <Pressable key={s.label} onPress={s.on} style={({ pressed }) => [styles.stat, i > 0 && styles.statSep, pressed && { backgroundColor: "#16161A" }]} accessibilityLabel={`${s.n} ${s.label}`}>
                    <Text style={styles.statN}>{s.n}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={onCrew}
                  disabled={busy}
                  style={({ pressed }) => [styles.crewButton, { backgroundColor: crewUi.bg, borderColor: crewUi.border }, pressed && { transform: [{ scale: 0.98 }] }]}
                  accessibilityLabel={crewUi.label}
                >
                  {busy ? <ActivityIndicator color={crewUi.fg} /> : <Text style={[styles.crewText, { color: crewUi.fg }]} numberOfLines={1}>{crewUi.label}</Text>}
                </Pressable>
                <Pressable style={({ pressed }) => [styles.messageButton, pressed && { backgroundColor: stream.raised }]} onPress={() => message(p)} accessibilityLabel="Message">
                  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={stream.ink} strokeWidth={2.2} strokeLinejoin="round">
                    <Path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.2-4.2A8.5 8.5 0 1 1 20.5 12z" />
                  </Svg>
                  <Text style={styles.messageText}>Message</Text>
                </Pressable>
                <Pressable style={[styles.suggButton, { borderColor: suggOpen ? stream.lime : "#2E2E35" }]} onPress={toggleSugg} accessibilityLabel="Similar roamers">
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={stream.ink} strokeWidth={2.2} strokeLinecap="round">
                    <Circle cx={9} cy={8} r={3.5} />
                    <Path d="M3 20a6 6 0 0 1 12 0M18 8v6M15 11h6" />
                  </Svg>
                </Pressable>
              </View>

              {p.mutuals.count > 0 ? (
                <Pressable style={styles.mutuals} onPress={() => openPeople("mutuals")} accessibilityLabel="Mutual crew">
                  <View style={{ flexDirection: "row" }}>
                    {p.mutuals.people.map((m) => (
                      <View key={m.id} style={styles.mutualFace}>
                        <Avatar handle={m.handle} displayName={m.displayName} avatarUrl={m.avatarUrl} size={22} radius={7} />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.mutualText} numberOfLines={1}>
                    In crew with{" "}
                    {p.mutuals.people.slice(0, 2).map((m, i) => (
                      <Text key={m.id}>
                        {i > 0 ? ", " : ""}
                        <Text style={styles.mutualName}>{m.handle}</Text>
                      </Text>
                    ))}
                    {p.mutuals.count > 2 ? ` + ${p.mutuals.count - 2} more` : ""}
                  </Text>
                </Pressable>
              ) : null}

              {suggOpen ? (
                <View style={{ gap: 10 }}>
                  <Text style={styles.sectionTitle}>Similar roamers</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                    {sugg === null ? <ActivityIndicator color={stream.lime} style={{ margin: 20 }} /> : null}
                    {sugg?.length === 0 ? <Text style={styles.emptySub}>No suggestions yet — check back as they build a crew.</Text> : null}
                    {sugg?.map((s) => {
                      const req = s.relationship === "requested";
                      return (
                        <Pressable key={s.id} style={styles.suggCard} onPress={() => navigation.push("UserProfile", { handle: s.handle })} accessibilityLabel={`Open ${s.handle}`}>
                          <Avatar handle={s.handle} displayName={s.displayName} avatarUrl={s.avatarUrl} size={52} radius={18} />
                          <Text style={styles.suggHandle} numberOfLines={1}>
                            {s.handle}
                          </Text>
                          <Text style={styles.suggWhy} numberOfLines={1}>
                            {s.why}
                          </Text>
                          <Pressable
                            style={[styles.suggJoin, { backgroundColor: req ? stream.raisedHover : stream.lime }]}
                            onPress={() => (s.relationship === "incoming" ? navigation.push("UserProfile", { handle: s.handle }) : suggCrew(s))}
                            accessibilityLabel={`${req ? "Cancel request to" : "Join crew with"} ${s.handle}`}
                          >
                            <Text style={[styles.suggJoinText, { color: req ? stream.inkMuted : stream.onLime }]}>{req ? "Requested" : s.relationship === "incoming" ? "Respond" : "Join crew"}</Text>
                          </Pressable>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {p.pins.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={styles.pins}>
                  {p.pins.map((pin) => {
                    const on = pinFilter === pin.label;
                    return (
                      <Pressable
                        key={pin.id}
                        style={styles.pinItem}
                        onPress={() => {
                          setPinFilter(on ? null : pin.label);
                          setTab("drops");
                          if (!on) toast(`${pin.emoji} ${pin.label}`);
                        }}
                        accessibilityLabel={`Pin ${pin.label}`}
                      >
                        <View style={[styles.pinBubble, { backgroundColor: pin.color, borderColor: on ? stream.lime : stream.ringSeen }]}>
                          <Text style={{ fontSize: 24 }}>{pin.emoji}</Text>
                        </View>
                        <Text style={[styles.pinLabel, on && { color: stream.lime }]} numberOfLines={1}>
                          {pin.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </>
          )}
        </View>

        {!blocked ? (
          <>
            <View style={{ marginTop: 16 }} onLayout={(e: LayoutChangeEvent) => setTabsY(e.nativeEvent.layout.y)}>
              {tabBar}
            </View>

            {locked ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 36, lineHeight: 40 }}>🔒</Text>
                <Text style={styles.emptyTitle}>This account is private</Text>
                <Text style={styles.emptySub}>Join {p.handle}'s crew to see their drops.</Text>
              </View>
            ) : tab === "drops" ? (
              drops === null ? (
                <ActivityIndicator color={stream.lime} style={{ marginTop: 30 }} />
              ) : gridDrops.length === 0 ? (
                pinFilter ? (
                  <Pressable style={styles.filterChip} onPress={() => setPinFilter(null)}>
                    <Text style={styles.filterChipText}>Nothing tagged #{pinFilter} · ✕ clear</Text>
                  </Pressable>
                ) : (
                  emptyFor("drops")
                )
              ) : (
                <>
                  {pinFilter ? (
                    <Pressable style={styles.filterChip} onPress={() => setPinFilter(null)}>
                      <Text style={styles.filterChipText}>
                        #{pinFilter} · {gridDrops.length} · ✕ clear
                      </Text>
                    </Pressable>
                  ) : null}
                  <MosaicGrid drops={gridDrops} burst={burst} onTile={onTile} />
                  <Text style={styles.hint}>Double-tap a drop to spark it ⚡</Text>
                </>
              )
            ) : tab === "places" && places.length > 0 ? (
              placeFilter ? (
                <>
                  <Pressable style={styles.filterChip} onPress={() => setPlaceFilter(null)}>
                    <Text style={styles.filterChipText}>← All places · 📍 {placeFilter}</Text>
                  </Pressable>
                  <MosaicGrid drops={places.find((x) => x.place === placeFilter)?.list ?? []} burst={burst} onTile={onTile} />
                </>
              ) : (
                <View style={{ paddingTop: 6 }}>
                  {places.map((x) => (
                    <Pressable key={x.place} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: "#131316" }]} onPress={() => setPlaceFilter(x.place)}>
                      <View style={styles.listGlyph}>
                        <Text style={{ fontSize: 20 }}>📍</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle}>{x.place}</Text>
                        <Text style={styles.listSub}>
                          {x.list.length} drop{x.list.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )
            ) : tab === "sounds" && sounds.length > 0 ? (
              <View style={{ paddingTop: 6 }}>
                {sounds.map((l) => (
                  <Pressable key={l.id} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: "#131316" }]} onPress={() => navigation.navigate("LoopsPlayer", l.roomId ? { roomId: l.roomId, startLoopId: l.id } : { loopId: l.id })}>
                    <View style={styles.listGlyph}>{l.coverUrl ? <Image source={{ uri: l.coverUrl }} style={StyleSheet.absoluteFill} /> : <Text style={{ fontSize: 20 }}>🎵</Text>}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{l.audioLabel}</Text>
                      <Text style={styles.listSub}>
                        {l.caption ?? "Loop"} · {fmtDur(l.durationSec)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : tab === "clips" && loops.length > 0 ? (
              <View style={styles.grid}>
                {loops.map((l, i) => (
                  <Pressable key={l.id} style={[styles.tile, { width: "32.8%", height: 200, backgroundColor: TINTS[i % 4] }]} onPress={() => navigation.navigate("LoopsPlayer", l.roomId ? { roomId: l.roomId, startLoopId: l.id } : { loopId: l.id })}>
                    {l.coverUrl ? <Image source={{ uri: l.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                    <Text style={styles.clipDur}>▶ {fmtDur(l.durationSec)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              emptyFor(tab)
            )}
          </>
        ) : null}
      </Animated.ScrollView>

      {header}

      {tabsY > 0 && !blocked ? (
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
        onSpark={(d) => spark(d)}
        onShare={(d) => setShareDrop(d)}
        onOpen={(d) => {
          setViewer(null);
          navigation.navigate("Drop", { dropId: d.id });
        }}
      />
      <ShareSheet drop={shareDrop} onClose={() => setShareDrop(null)} onShared={() => {}} />
      <MomentViewer
        groups={moments}
        startGroup={momentOpen}
        myUserId={me?.id}
        onClose={() => setMomentOpen(null)}
        onFrameSeen={(gi, fi) =>
          setMoments((prev) => prev.map((g, i) => (i !== gi ? g : { ...g, frames: g.frames.map((f, j) => (j === fi ? { ...f, seen: true } : f)) })))
        }
      />

      <BottomSheet visible={sheet === "menu"} onClose={() => setSheet(null)}>
        <View style={styles.menu}>
          <MenuRow icon="🔗" label="Copy profile link" onPress={async () => { setSheet(null); await Clipboard.setStringAsync(profileLink(p.handle)).catch(() => {}); toast(`rebanter.app/${p.handle} copied`); }} />
          <MenuRow icon="📤" label="Share profile" onPress={() => setSheet("share")} />
          {!blocked ? (
            <>
              <MenuRow icon="🔕" label="Mute drops" toggle={p.viewer.muted} onPress={() => toggle("mute", "muted", `Muted ${p.handle}'s drops`, "Unmuted")} />
              <MenuRow icon="🫥" label="Restrict" toggle={p.viewer.restricted} onPress={() => toggle("restrict", "restricted", `Restricted ${p.handle}`, "Unrestricted")} />
              {p.relationship === "incoming" ? <MenuRow icon="🙅" label="Skip crew request" onPress={skipRequest} /> : null}
              {p.relationship === "crew" ? (
                <MenuRow
                  icon="👋"
                  label="Leave crew"
                  onPress={() => {
                    setSheet(null);
                    setConfirmLeave(true);
                    onCrew();
                  }}
                />
              ) : null}
            </>
          ) : null}
          <MenuRow icon="🚫" label={blocked ? "Unblock" : "Block"} danger={!blocked} onPress={() => (blocked ? block(false) : setSheet("block"))} />
          <MenuRow icon="⚠️" label="Report" danger onPress={() => setSheet("report")} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === "block"} onClose={() => setSheet(null)} title={`Block ${p.handle}?`}>
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <Text style={styles.sheetBody}>They won't be able to find your profile, see your drops or moments, or message you. You'll leave each other's crew. They won't be told.</Text>
          <Pressable style={styles.dangerButton} onPress={() => block(true)} accessibilityLabel="Confirm block">
            <Text style={styles.dangerText}>Block</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setSheet(null)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === "report"} onClose={() => setSheet(null)} title={`Report ${p.handle}`}>
        <View style={styles.menu}>
          <Text style={[styles.sheetBody, { paddingHorizontal: 10, paddingBottom: 6 }]}>Your report is anonymous. What's going on?</Text>
          {REPORT_REASONS.map(([id, label]) => (
            <MenuRow key={id} label={label} onPress={() => report(id)} />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === "crew" || sheet === "mutuals"} onClose={() => setSheet(null)} title={sheet === "crew" ? `Crew · ${p.stats.crew}` : `Mutual crew · ${p.mutuals.count}`} fill>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          {people === null ? <ActivityIndicator color={stream.lime} style={{ marginTop: 20 }} /> : null}
          {peopleLocked ? <Text style={styles.emptySub}>{p.handle}'s crew is private.</Text> : null}
          {(people ?? [])
            .filter((m) => sheet === "crew" || m.mutual)
            .map((m) => (
              <Pressable
                key={m.id}
                style={styles.personRow}
                onPress={() => {
                  setSheet(null);
                  if (m.isYou) navigation.navigate("Tabs", { screen: "Me" });
                  else navigation.push("UserProfile", { handle: m.handle });
                }}
                accessibilityLabel={`Open ${m.handle}`}
              >
                <Avatar handle={m.handle} displayName={m.displayName} avatarUrl={m.avatarUrl} size={44} radius={15} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.personHandle} numberOfLines={1}>
                    {m.isYou ? "you" : m.handle}
                  </Text>
                  <Text style={styles.personSub} numberOfLines={1}>
                    {m.isYou ? "That's you" : m.mutual ? "In your crew too" : m.displayName}
                  </Text>
                </View>
                {!m.isYou ? (
                  <Pressable style={styles.personMessage} onPress={() => message(m)} accessibilityLabel={`Message ${m.handle}`}>
                    <Text style={styles.personMessageText}>Message</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            ))}
          {people && !peopleLocked && (people ?? []).filter((m) => sheet === "crew" || m.mutual).length === 0 ? (
            <Text style={[styles.emptySub, { marginTop: 16 }]}>{sheet === "crew" ? `${p.handle} hasn't built a crew yet.` : "No crew in common yet."}</Text>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <ShareCardSheet
        visible={sheet === "share"}
        handle={p.handle}
        onClose={() => setSheet(null)}
        onDirect={() => {
          setSheet(null);
          navigation.navigate("Banters");
        }}
        toast={toast}
      />
    </View>
  );
}

// ---- pieces --------------------------------------------------------------------------

function fmtDur(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function Bell({ on, beat, onPress }: { on: boolean; beat: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!beat) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 130, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [beat, scale]);
  return (
    <Pressable style={[styles.headerButton, on && { backgroundColor: stream.lime }]} onPress={onPress} accessibilityLabel={on ? "Turn off drop alerts" : "Turn on drop alerts"} accessibilityState={{ selected: on }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill={on ? stream.onLime : "none"} stroke={on ? stream.onLime : stream.ink} strokeWidth={2} strokeLinejoin="round">
          <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
          <Path d="M10 20.5a2 2 0 0 0 4 0" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

function PresencePill({ online, text }: { online: boolean; text: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!online) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [online, pulse]);
  return (
    <View style={styles.presence}>
      <Animated.View style={[styles.presenceDot, { backgroundColor: online ? stream.lime : stream.inkFaint, opacity: pulse }]} />
      <Text style={styles.presenceText}>{text}</Text>
    </View>
  );
}

function MenuRow({ icon, label, toggle, danger, onPress }: { icon?: string; label: string; toggle?: boolean; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: stream.raised }]} onPress={onPress} accessibilityLabel={label} accessibilityState={toggle !== undefined ? { checked: toggle } : undefined}>
      {icon ? (
        <View style={styles.menuIcon}>
          <Text style={{ fontSize: 16 }}>{icon}</Text>
        </View>
      ) : null}
      <Text style={[styles.menuLabel, danger && { color: stream.redSoft }]}>{label}</Text>
      {toggle !== undefined ? (
        <View style={[styles.toggle, { backgroundColor: toggle ? stream.lime : stream.ringSeen }]}>
          <View style={[styles.knob, { left: toggle ? 19 : 3 }]} />
        </View>
      ) : null}
    </Pressable>
  );
}

function SlidingTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
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
          <Text style={[styles.tabText, { color: tab === id ? stream.bg : stream.inkMuted }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** The zap that pops over a tile when you double-tap it. */
function SparkBurst({ n }: { n: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [n, v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          alignItems: "center",
          justifyContent: "center",
          opacity: v.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { scale: v.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1.2, 1, 1.1] }) },
            { translateY: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, -20] }) },
          ],
        },
      ]}
    >
      <ZapGlyph size={56} color={stream.lime} />
    </Animated.View>
  );
}

function Tile({ d, index, height, burst, onPress }: { d: Drop; index: number; height: number; burst: { id: string; n: number } | null; onPress: (d: Drop) => void }) {
  const theme = d.takeColor ? { bg: d.takeColor, ink: "#0C0C0E" } : takeTheme(d.id);
  const isText = !d.media[0];
  return (
    <Pressable
      style={[styles.tile, { height, backgroundColor: d.kind === "take" ? theme.bg : isText ? stream.card : TINTS[index % 4] }]}
      onPress={() => onPress(d)}
      accessibilityLabel={`Drop${d.caption ? `: ${d.caption}` : d.body ? `: ${d.body}` : ""}`}
    >
      {d.media[0] ? (
        <Image source={{ uri: d.media[0].url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Text style={[styles.tileText, { color: d.kind === "take" ? theme.ink : stream.ink }]} numberOfLines={height > 200 ? 8 : 5}>
          {d.kind === "poll" ? "📊 " : ""}
          {d.body}
        </Text>
      )}
      <View style={styles.tileShade} pointerEvents="none" />
      {d.media.length > 1 ? <Text style={styles.multi}>1/{d.media.length}</Text> : null}
      {d.pinnedAt ? <Text style={styles.pinned}>📌</Text> : null}
      {!d.countsHidden ? (
        <View style={styles.sparks} pointerEvents="none">
          <ZapGlyph size={12} color={d.likedByMe ? stream.lime : stream.ink} />
          <Text style={[styles.sparksText, d.likedByMe && { color: stream.lime }]}>{d.counts.likes}</Text>
        </View>
      ) : null}
      {burst?.id === d.id ? <SparkBurst n={burst.n} /> : null}
    </Pressable>
  );
}

/**
 * Three-column mosaic from the design: every block of five drops is one tall
 * tile plus a 2×2 of small ones (the tall side alternates), leftovers fill a
 * plain row.
 */
function MosaicGrid({ drops, burst, onTile }: { drops: Drop[]; burst: { id: string; n: number } | null; onTile: (d: Drop) => void }) {
  const SMALL = 150;
  const GAP = 4;
  const blocks: Drop[][] = [];
  for (let i = 0; i < drops.length; i += 5) blocks.push(drops.slice(i, i + 5));
  return (
    <View style={{ paddingHorizontal: 4, paddingTop: 4, gap: GAP }}>
      {blocks.map((b, bi) => {
        const base = bi * 5;
        if (b.length < 5) {
          return (
            <View key={bi} style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
              {b.map((d, i) => (
                <View key={d.id} style={{ width: "32.6%" }}>
                  <Tile d={d} index={base + i} height={SMALL} burst={burst} onPress={onTile} />
                </View>
              ))}
            </View>
          );
        }
        const [tall, ...small] = b;
        const tallCol = (
          <View style={{ flex: 1 }}>
            <Tile d={tall} index={base} height={SMALL * 2 + GAP} burst={burst} onPress={onTile} />
          </View>
        );
        const smallCols = [0, 1].map((col) => (
          <View key={col} style={{ flex: 1, gap: GAP }}>
            {[small[col], small[col + 2]].map((d, r) => (
              <Tile key={d.id} d={d} index={base + 1 + col + r * 2} height={SMALL} burst={burst} onPress={onTile} />
            ))}
          </View>
        ));
        return (
          <View key={bi} style={{ flexDirection: "row", gap: GAP }}>
            {bi % 2 === 0 ? (
              <>
                {tallCol}
                {smallCols}
              </>
            ) : (
              <>
                {smallCols}
                {tallCol}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg },
  error: { marginTop: 140, paddingHorizontal: 32, textAlign: "center", fontFamily: fonts.bodyMedium, fontSize: 14, color: stream.redSoft },
  cover: { height: COVER_H, overflow: "hidden", backgroundColor: "#1C2430" },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70, backgroundColor: "rgba(12,12,14,0.55)" },
  body: { paddingHorizontal: 16, marginTop: -58, gap: 14 },
  idRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  avatarWrap: { width: 116, height: 124, alignItems: "center" },
  avatarInner: { width: 108, height: 108, borderRadius: 34, backgroundColor: stream.bg, alignItems: "center", justifyContent: "center" },
  newMoment: {
    position: "absolute",
    bottom: 0,
    paddingHorizontal: 8,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: stream.lime,
    color: stream.onLime,
    borderWidth: 2.5,
    borderColor: stream.bg,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 15,
  },
  presence: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, borderRadius: 999, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#24242A" },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  presenceText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: stream.ink },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -1, color: stream.ink },
  followsYou: { height: 22, lineHeight: 22, paddingHorizontal: 8, borderRadius: 7, overflow: "hidden", backgroundColor: stream.raised, color: stream.inkMuted, fontFamily: fonts.bodySemibold, fontSize: 11 },
  handle: { fontFamily: fonts.body, fontSize: 14, color: stream.inkMuted, marginTop: -4 },
  bio: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20, color: stream.inkSoft },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 },
  chip: { height: 30, lineHeight: 28, paddingLeft: 9, paddingRight: 12, borderRadius: 999, overflow: "hidden", backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#26262C", color: stream.ink, fontFamily: fonts.bodySemibold, fontSize: 12.5 },
  stats: { flexDirection: "row", borderWidth: 1, borderColor: "#1F1F24", borderRadius: 20, backgroundColor: "#111114", overflow: "hidden" },
  stat: { flex: 1, alignItems: "center", gap: 4, paddingTop: 14, paddingBottom: 12 },
  statSep: { borderLeftWidth: 1, borderLeftColor: "#1F1F24" },
  statN: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.7, color: stream.ink },
  statLabel: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: stream.inkMuted },
  actions: { flexDirection: "row", gap: 8 },
  crewButton: { flex: 1, height: 46, paddingHorizontal: 8, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  crewText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  messageButton: { flex: 1, height: 46, flexDirection: "row", gap: 7, borderWidth: 1, borderColor: "#2E2E35", borderRadius: 15, backgroundColor: stream.sheet, alignItems: "center", justifyContent: "center" },
  messageText: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: stream.ink },
  suggButton: { width: 46, height: 46, borderWidth: 1, borderRadius: 15, backgroundColor: stream.sheet, alignItems: "center", justifyContent: "center" },
  mutuals: { flexDirection: "row", alignItems: "center", gap: 10 },
  mutualFace: { width: 26, height: 26, marginRight: -8, borderRadius: 9, borderWidth: 2, borderColor: stream.bg, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  mutualText: { flex: 1, marginLeft: 6, fontFamily: fonts.body, fontSize: 13, color: stream.inkSoft },
  mutualName: { fontFamily: fonts.bodySemibold, color: stream.ink },
  sectionTitle: { fontFamily: fonts.display, fontSize: 15, color: stream.ink },
  suggCard: { width: 128, paddingTop: 14, paddingHorizontal: 10, paddingBottom: 10, borderRadius: 20, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24", alignItems: "center", gap: 6 },
  suggHandle: { maxWidth: 108, fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.ink },
  suggWhy: { maxWidth: 108, fontFamily: fonts.body, fontSize: 11, color: stream.inkMuted },
  suggJoin: { alignSelf: "stretch", height: 30, marginTop: 4, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  suggJoinText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  pins: { gap: 14, paddingHorizontal: 16, paddingVertical: 2 },
  pinItem: { width: 64, alignItems: "center", gap: 6 },
  pinBubble: { width: 60, height: 60, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pinLabel: { maxWidth: 64, fontFamily: fonts.bodyMedium, fontSize: 11.5, color: stream.ink },
  blockCard: { padding: 16, gap: 8, borderRadius: 20, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24" },
  blockTitle: { fontFamily: fonts.display, fontSize: 17, color: stream.ink },
  blockSub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: stream.inkMuted },
  unblock: { alignSelf: "flex-start", marginTop: 4, height: 40, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1, borderColor: "#2E2E35", justifyContent: "center" },
  unblockText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.ink },
  tabRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(12,12,14,0.94)" },
  tabs: { flexDirection: "row", padding: 4, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24", borderRadius: 16 },
  tabThumb: { position: "absolute", top: 4, bottom: 4, borderRadius: 12, backgroundColor: stream.ink },
  tabButton: { flex: 1, height: 34, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: fonts.bodySemibold, fontSize: 12.5 },
  floatingTabs: { position: "absolute", left: 0, right: 0, top: TOP_INSET + HEADER_H, zIndex: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 4, paddingTop: 4 },
  tile: { borderRadius: 12, overflow: "hidden", justifyContent: "center" },
  tileText: { paddingHorizontal: 10, fontFamily: fonts.display, fontSize: 13, lineHeight: 15 },
  tileShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 54, backgroundColor: "rgba(0,0,0,0.3)" },
  multi: { position: "absolute", right: 8, top: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, overflow: "hidden", backgroundColor: "rgba(12,12,14,0.8)", color: stream.ink, fontFamily: fonts.bodyBold, fontSize: 10.5 },
  pinned: { position: "absolute", left: 8, top: 8, fontSize: 13 },
  sparks: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  sparksText: { fontFamily: fonts.bodyBold, fontSize: 12, color: stream.ink },
  clipDur: { position: "absolute", left: 8, top: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(12,12,14,0.8)", color: stream.ink, fontFamily: fonts.bodyBold, fontSize: 10.5 },
  hint: { padding: 14, textAlign: "center", fontFamily: fonts.body, fontSize: 12, color: stream.inkFaint },
  filterChip: { alignSelf: "flex-start", marginLeft: 12, marginTop: 6, paddingHorizontal: 12, height: 30, justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(200,241,105,0.12)" },
  filterChipText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.lime },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  listGlyph: { width: 46, height: 46, borderRadius: 15, backgroundColor: stream.raised, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  listTitle: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  listSub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  empty: { alignItems: "center", gap: 8, paddingVertical: 44, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 18, color: stream.ink, marginTop: 4 },
  emptySub: { fontFamily: fonts.body, fontSize: 13.5, color: stream.inkMuted, textAlign: "center" },
  header: { position: "absolute", left: 0, right: 0, top: 0, paddingTop: TOP_INSET, height: TOP_INSET + HEADER_H, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, zIndex: 20 },
  headerBacking: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: stream.bg, borderBottomWidth: 1, borderBottomColor: "#222228" },
  headerName: { fontFamily: fonts.display, fontSize: 15, color: stream.ink },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: stream.inkMuted },
  headerButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(12,12,14,0.6)", alignItems: "center", justifyContent: "center" },
  menu: { paddingHorizontal: 16, paddingBottom: 8, gap: 2 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, height: 52, paddingHorizontal: 10, borderRadius: 14 },
  menuIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: stream.raised, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: stream.ink },
  toggle: { width: 40, height: 24, borderRadius: 12 },
  knob: { position: "absolute", top: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: stream.ink },
  sheetBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: stream.inkMuted },
  dangerButton: { height: 48, borderRadius: 15, backgroundColor: stream.redSoft, alignItems: "center", justifyContent: "center" },
  dangerText: { fontFamily: fonts.bodyBold, fontSize: 15, color: stream.bg },
  cancelButton: { height: 48, borderRadius: 15, borderWidth: 1, borderColor: "#2E2E35", alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: stream.ink },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  personHandle: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  personSub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  personMessage: { height: 32, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: "#34343B", justifyContent: "center" },
  personMessageText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.ink },
});
