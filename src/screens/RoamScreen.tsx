import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { setStatusBarStyle } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import { stream, fonts, TAB_BAR_CLEARANCE } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/stream/Toast";
import { CloseGlyph, SearchGlyph, VerifiedGlyph } from "@/components/stream/StreamIcons";
import { compact } from "@/components/stream/format";
import { LiveDot, RoomCard, roomTheme, withCommas } from "@/components/roam/RoomCard";
import { Mosaic } from "@/components/roam/Mosaic";
import { ScanSheet, type ScanTarget } from "@/components/roam/ScanSheet";
import { getRooms, joinRoom } from "@/api/rooms";
import { getExplore, getTrending, type ExploreCategory } from "@/api/roam";
import { search, type SearchResults } from "@/api/search";
import { acceptCrewRequest, sendCrewRequest } from "@/api/crew";
import { useSession } from "@/session/SessionContext";
import { getItem, setItem } from "@/session/tokenStore";
import type { ExploreTile, PersonResult, Room, TagStat } from "@/api/types";
import type { RootStackParamList, TabParamList } from "@/navigation/types";

type SearchTab = "top" | "people" | "tags" | "rooms";
const SEARCH_TABS: [SearchTab, string][] = [
  ["top", "Top"],
  ["people", "People"],
  ["tags", "Tags"],
  ["rooms", "Rooms"],
];
const CHIPS: [ExploreCategory, string, string][] = [
  ["all", "For you", "✦"],
  ["loops", "Loops", "▶"],
  ["makers", "Makers", "✂"],
  ["food", "Food", "🍜"],
  ["travel", "Travel", "⛰"],
  ["cars", "Cars", "🏎"],
];
const TAG_COLORS = ["#FFB020", "#C8F169", "#1FB7A6", "#FF7AB6", "#FF5C39", "#3E7BFA", "#B36CFF"];

/** A recent search, snapshotted so it renders without a round-trip. */
type Recent =
  | { type: "person"; key: string; title: string; sub: string; avatarUrl: string | null; displayName: string }
  | { type: "tag"; key: string; title: string; sub: string }
  | { type: "room"; key: string; title: string; sub: string };

const tagMeta = (t: TagStat) => (t.takes > t.posts ? `${compact(t.takes + t.posts)} takes` : `${compact(t.posts + t.takes)} posts`);
const tagColor = (tag: string) => TAG_COLORS[[...tag.toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) % TAG_COLORS.length];

export function RoamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList> & BottomTabNavigationProp<TabParamList>>();
  const { user } = useSession();
  const toast = useToast();
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roamingNow, setRoamingNow] = useState(0);
  const [trends, setTrends] = useState<TagStat[]>([]);
  const [chip, setChip] = useState<ExploreCategory>("all");
  const [tiles, setTiles] = useState<ExploreTile[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");
  const [sTab, setSTab] = useState<SearchTab>("top");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [scanOpen, setScanOpen] = useState(false);

  const searching = focused || q.trim().length > 0;
  const recentsKey = user ? `rebanter.roamRecents.${user.id}` : null;

  // ---- data ---------------------------------------------------------------
  const loadIdle = useCallback(async () => {
    const [r, t] = await Promise.allSettled([getRooms(), getTrending()]);
    if (r.status === "fulfilled") {
      setRooms(r.value.items.filter((x) => x.status === "LIVE"));
      setRoamingNow(r.value.roamingNow);
    }
    if (t.status === "fulfilled") setTrends(t.value.items);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    setTiles(null);
    getExplore(chip)
      .then((res) => setTiles(res.items))
      .catch(() => setTiles([]));
  }, [chip]);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      loadIdle();
      return () => setStatusBarStyle("dark");
    }, [loadIdle])
  );

  // Tapping the Roam tab while here clears search and scrolls to the top.
  useEffect(
    () =>
      navigation.addListener("tabPress", () => {
        if (!navigation.isFocused()) return;
        cancelSearch();
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }),
    [navigation]
  );

  useEffect(() => {
    if (!recentsKey) return;
    getItem(recentsKey)
      .then((raw) => raw && setRecents(JSON.parse(raw)))
      .catch(() => {});
  }, [recentsKey]);

  function saveRecents(next: Recent[]) {
    setRecents(next);
    if (recentsKey) setItem(recentsKey, JSON.stringify(next)).catch(() => {});
  }
  function addRecent(r: Recent) {
    saveRecents([r, ...recents.filter((x) => !(x.type === r.type && x.key === r.key))].slice(0, 8));
  }

  // Debounced live search.
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const t = setTimeout(() => {
      search(term)
        .then(setResults)
        .catch(() => setResults({ users: [], rooms: [], tags: [] }))
        .finally(() => setIsSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function cancelSearch() {
    setQ("");
    setFocused(false);
    setSTab("top");
    inputRef.current?.blur();
  }

  // ---- actions -------------------------------------------------------------
  const updateRoom = (room: Room) => {
    setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    setResults((prev) => prev && { ...prev, rooms: prev.rooms.map((r) => (r.id === room.id ? room : r)) });
  };

  async function toggleJoin(room: Room) {
    const join = !room.joinedByMe;
    updateRoom({ ...room, joinedByMe: join, participantCount: room.participantCount + (join ? 1 : -1) });
    setRoamingNow((n) => n + (join ? 1 : -1));
    toast(join ? `You joined “${room.title}”` : "Left the room");
    try {
      updateRoom(await joinRoom(room.id, join));
    } catch (err) {
      updateRoom(room);
      setRoamingNow((n) => n - (join ? 1 : -1));
      toast(err instanceof Error ? err.message : "Couldn't update that room");
    }
  }

  function openRoom(room: Room) {
    addRecent({ type: "room", key: room.id, title: room.title, sub: `hosted by ${room.host.handle}` });
    if (!room.joinedByMe) toggleJoin(room);
    navigation.navigate("LoopsPlayer", { roomId: room.id });
  }

  function openTag(tag: string, stat?: TagStat) {
    const clean = tag.replace(/^#/, "");
    addRecent({ type: "tag", key: clean.toLowerCase(), title: `#${clean}`, sub: stat ? tagMeta(stat) : "Hashtag" });
    navigation.navigate("Tag", { tag: clean });
  }

  function openPerson(p: { handle: string; displayName: string; avatarUrl: string | null }) {
    addRecent({ type: "person", key: p.handle, title: p.handle, sub: p.displayName, avatarUrl: p.avatarUrl, displayName: p.displayName });
    navigation.navigate("UserProfile", { handle: p.handle });
  }

  async function follow(p: PersonResult) {
    const accept = p.relationship === "incoming";
    const set = (relationship: PersonResult["relationship"]) =>
      setResults((prev) => prev && { ...prev, users: prev.users.map((u) => (u.id === p.id ? { ...u, relationship } : u)) });
    set(accept ? "crew" : "requested");
    try {
      if (accept) await acceptCrewRequest(p.id);
      else await sendCrewRequest(p.id);
      toast(accept ? `You and ${p.handle} are crew now` : `Crew request sent to ${p.handle}`);
    } catch (err) {
      set(p.relationship);
      toast(err instanceof Error ? err.message : "Couldn't send that request");
    }
  }

  function onScanned(target: ScanTarget) {
    if (target.kind === "user") {
      if (target.handle === user?.handle) toast("That's your own code 👋");
      else navigation.navigate("UserProfile", { handle: target.handle });
    } else navigation.navigate("Drop", { dropId: target.dropId });
  }

  function openTile(tile: ExploreTile) {
    if (tile.type === "loop" && tile.roomId) navigation.navigate("LoopsPlayer", { roomId: tile.roomId, startLoopId: tile.id });
    else if (tile.dropId) navigation.navigate("Drop", { dropId: tile.dropId });
  }

  // ---- search lists ----------------------------------------------------------
  const r = results;
  const people = r?.users ?? [];
  const tagResults = r?.tags ?? [];
  const roomResults = r?.rooms ?? [];
  const shown =
    sTab === "people"
      ? { people, rooms: [], tags: [] }
      : sTab === "tags"
        ? { people: [], rooms: [], tags: tagResults }
        : sTab === "rooms"
          ? { people: [], rooms: roomResults, tags: [] }
          : { people: people.slice(0, 4), rooms: roomResults.slice(0, 2), tags: tagResults.slice(0, 3) };
  const noResults = !!q.trim() && !isSearching && shown.people.length + shown.rooms.length + shown.tags.length === 0;
  const visibleRecents = recents.filter((x) => sTab === "top" || x.type === (sTab === "people" ? "person" : sTab === "tags" ? "tag" : "room"));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {!searching ? (
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              Roam<Text style={{ color: stream.lime }}>.</Text>
            </Text>
            <Pressable style={styles.scanButton} onPress={() => setScanOpen(true)} accessibilityLabel="Scan a Rebanter code">
              <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={stream.ink} strokeWidth={2} strokeLinecap="round">
                <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7.5 12h9" />
              </Svg>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { borderColor: focused ? stream.lime : "#222228" }]}>
            <SearchGlyph size={19} color={stream.inkMuted} />
            <TextInput
              ref={inputRef}
              value={q}
              onChangeText={setQ}
              onFocus={() => setFocused(true)}
              placeholder="People, tags, rooms"
              placeholderTextColor="#8C8A94"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {q ? (
              <Pressable
                style={styles.clear}
                onPress={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                accessibilityLabel="Clear search"
              >
                <CloseGlyph size={12} />
              </Pressable>
            ) : null}
          </View>
          {searching ? (
            <Pressable onPress={cancelSearch} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
        {searching ? (
          <View style={styles.sTabs}>
            {SEARCH_TABS.map(([id, label]) => (
              <Pressable key={id} onPress={() => setSTab(id)} style={[styles.sTab, sTab === id && { backgroundColor: stream.ink }]}>
                <Text style={[styles.sTabText, { color: sTab === id ? stream.bg : "#B9B7C0" }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + 6 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          !searching ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadIdle();
                getExplore(chip)
                  .then((res) => setTiles(res.items))
                  .catch(() => {});
              }}
              tintColor={stream.inkMuted}
            />
          ) : undefined
        }
      >
        {!searching ? (
          <View style={{ gap: 22, paddingTop: 6 }}>
            <View style={{ gap: 12 }}>
              <View style={styles.sectionHead}>
                <View style={styles.liveTitle}>
                  <LiveDot size={8} />
                  <Text style={styles.sectionTitle}>Live Rooms</Text>
                </View>
                <Text style={styles.sectionMeta}>{withCommas(roamingNow)} roaming now</Text>
              </View>
              {rooms.length === 0 ? (
                <Text style={styles.emptyLine}>No rooms are live right now — check back soon.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={262} decelerationRate="fast" contentContainerStyle={styles.hRow}>
                  {rooms.map((room) => (
                    <RoomCard key={room.id} room={room} onOpen={openRoom} onJoin={toggleJoin} />
                  ))}
                </ScrollView>
              )}
            </View>

            {trends.length > 0 ? (
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { paddingHorizontal: 16 }]}>Trending banter</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.hRow, { gap: 8 }]}>
                  {trends.slice(0, 5).map((t) => (
                    <Pressable
                      key={t.tag}
                      style={({ pressed }) => [styles.trend, pressed && { backgroundColor: stream.raised }]}
                      onPress={() => {
                        setQ(`#${t.tag}`);
                        setFocused(true);
                        setSTab("tags");
                      }}
                      accessibilityLabel={`#${t.tag}`}
                    >
                      <View style={[styles.hash, { backgroundColor: tagColor(t.tag) }]}>
                        <Text style={styles.hashText}>#</Text>
                      </View>
                      <View>
                        <Text style={styles.trendTag}>#{t.tag}</Text>
                        <Text style={styles.trendMeta}>{tagMeta(t)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ gap: 12 }}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>For You</Text>
                <Text style={styles.sectionMeta}>{tiles ? `${tiles.length} picks` : ""}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.hRow, { gap: 6 }]}>
                {CHIPS.map(([id, label, icon]) => {
                  const active = chip === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setChip(id)}
                      style={[styles.chip, { backgroundColor: active ? stream.lime : "transparent", borderColor: active ? stream.lime : stream.raisedBorder }]}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, { color: active ? stream.onLime : stream.inkSoft }]}>
                        {icon} {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {tiles === null ? (
                <ActivityIndicator style={{ marginVertical: 30 }} color={stream.lime} />
              ) : tiles.length === 0 ? (
                <Text style={styles.emptyLine}>Nothing here yet — try another category.</Text>
              ) : (
                <Mosaic tiles={tiles} onOpen={openTile} />
              )}
            </View>
          </View>
        ) : !q.trim() ? (
          <View style={{ paddingTop: 6 }}>
            <View style={[styles.sectionHead, { paddingBottom: 8 }]}>
              <Text style={[styles.sectionTitle, { fontSize: 16 }]}>Recent</Text>
              {visibleRecents.length > 0 ? (
                <Pressable onPress={() => saveRecents(recents.filter((x) => !visibleRecents.includes(x)))} hitSlop={8}>
                  <Text style={styles.clearAll}>Clear all</Text>
                </Pressable>
              ) : null}
            </View>
            {visibleRecents.length === 0 ? <Text style={styles.nothing}>Nothing yet — go roam.</Text> : null}
            {visibleRecents.map((x) => (
              <Pressable
                key={`${x.type}:${x.key}`}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#131316" }]}
                onPress={() =>
                  x.type === "person"
                    ? openPerson({ handle: x.key, displayName: x.displayName, avatarUrl: x.avatarUrl })
                    : x.type === "tag"
                      ? openTag(x.key)
                      : navigation.navigate("LoopsPlayer", { roomId: x.key })
                }
              >
                <RowGlyph kind={x.type} seed={x.key} person={x.type === "person" ? { handle: x.key, displayName: x.displayName, avatarUrl: x.avatarUrl } : undefined} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {x.title}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {x.sub}
                  </Text>
                </View>
                <Pressable
                  style={styles.remove}
                  onPress={() => saveRecents(recents.filter((k) => !(k.type === x.type && k.key === x.key)))}
                  accessibilityLabel={`Remove ${x.title} from recents`}
                >
                  <CloseGlyph size={15} color={stream.inkMuted} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ paddingTop: 4 }}>
            {isSearching && !r ? <ActivityIndicator style={{ marginTop: 24 }} color={stream.lime} /> : null}
            {noResults ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsTitle}>No one's roaming here</Text>
                <Text style={styles.rowSub}>Try a name, a #tag or a room.</Text>
              </View>
            ) : null}
            {shown.people.map((p) => {
              const button =
                p.relationship === "crew"
                  ? { label: "Following", active: false }
                  : p.relationship === "requested"
                    ? { label: "Requested", active: false }
                    : p.relationship === "incoming"
                      ? { label: "Accept", active: true }
                      : { label: "Follow", active: true };
              return (
                <Pressable key={p.id} style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#131316" }]} onPress={() => openPerson(p)}>
                  <RowGlyph kind="person" seed={p.handle} person={p} />
                  <View style={styles.rowText}>
                    <View style={styles.rowTitleLine}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {p.handle}
                      </Text>
                      {p.isVerified ? <VerifiedGlyph size={13} /> : null}
                    </View>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {[p.displayName, p.context].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <ActionButton label={button.label} active={button.active} onPress={() => button.active && follow(p)} />
                </Pressable>
              );
            })}
            {shown.rooms.map((room) => (
              <Pressable key={room.id} style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#131316" }]} onPress={() => openRoom(room)}>
                <RowGlyph kind="room" seed={room.id} live={room.status === "LIVE"} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {room.title}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {room.status === "LIVE" ? `${withCommas(room.participantCount)} roaming` : "Starting soon"} · hosted by {room.host.handle}
                  </Text>
                </View>
                <ActionButton label={room.joinedByMe ? "Joined" : "Join"} active={!room.joinedByMe} onPress={() => toggleJoin(room)} />
              </Pressable>
            ))}
            {shown.tags.map((t) => (
              <Pressable key={t.tag} style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#131316" }]} onPress={() => openTag(t.tag, t)}>
                <RowGlyph kind="tag" seed={t.tag} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>#{t.tag}</Text>
                  <Text style={styles.rowSub}>{tagMeta(t)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <ScanSheet visible={scanOpen} handle={user?.handle ?? ""} onClose={() => setScanOpen(false)} onScanned={onScanned} />
    </View>
  );
}

function RowGlyph({
  kind,
  seed,
  person,
  live,
}: {
  kind: "person" | "tag" | "room";
  seed: string;
  person?: { handle: string; displayName: string; avatarUrl: string | null };
  live?: boolean;
}) {
  if (kind === "person" && person) return <Avatar handle={person.handle} displayName={person.displayName} avatarUrl={person.avatarUrl} size={46} radius={23} />;
  const bg = kind === "tag" ? tagColor(seed) : roomTheme(seed).bg;
  return (
    <View>
      <View style={[styles.glyph, { backgroundColor: bg }]}>
        <Text style={styles.glyphText}>{kind === "tag" ? "#" : "◉"}</Text>
      </View>
      {live ? <Text style={styles.liveBadge}>LIVE</Text> : null}
    </View>
  );
}

function ActionButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, { backgroundColor: active ? stream.lime : "transparent", borderColor: active ? stream.lime : stream.ringSeen }]}
      accessibilityLabel={label}
    >
      <Text style={[styles.actionText, { color: active ? stream.onLime : stream.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg },
  header: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, gap: 12, backgroundColor: "rgba(12,12,14,0.9)", zIndex: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 40 },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -1.2, color: stream.ink },
  scanButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#18181C", alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: 44, paddingLeft: 14, paddingRight: 8, backgroundColor: "#18181C", borderWidth: 1.5, borderRadius: 16 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 15, color: stream.ink, paddingVertical: 0 },
  clear: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#2E2E35", alignItems: "center", justifyContent: "center" },
  cancel: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink, paddingHorizontal: 2 },
  sTabs: { flexDirection: "row", gap: 4, padding: 3, backgroundColor: stream.card, borderWidth: 1, borderColor: "#222228", borderRadius: 14 },
  sTab: { flex: 1, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sTabText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  liveTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, color: stream.ink },
  sectionMeta: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  hRow: { gap: 10, paddingHorizontal: 16 },
  emptyLine: { fontFamily: fonts.body, fontSize: 13.5, color: stream.inkMuted, paddingHorizontal: 16 },
  trend: { flexDirection: "row", alignItems: "center", gap: 10, height: 52, paddingLeft: 6, paddingRight: 14, borderWidth: 1, borderColor: stream.cardBorder, borderRadius: 18, backgroundColor: stream.sheet },
  hash: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  hashText: { fontFamily: fonts.display, fontSize: 18, color: stream.onLime },
  trendTag: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: stream.ink },
  trendMeta: { fontFamily: fonts.body, fontSize: 11.5, color: stream.inkMuted },
  chip: { height: 34, paddingHorizontal: 14, borderWidth: 1, borderRadius: 999, justifyContent: "center" },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  clearAll: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.lime },
  nothing: { fontFamily: fonts.body, fontSize: 13.5, color: stream.inkMuted, textAlign: "center", paddingVertical: 30 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingLeft: 16, paddingRight: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  remove: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  glyph: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  glyphText: { fontFamily: fonts.display, fontSize: 16, color: stream.onLime },
  liveBadge: {
    position: "absolute",
    alignSelf: "center",
    bottom: -5,
    paddingHorizontal: 5,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: stream.red,
    color: "#fff",
    borderWidth: 2,
    borderColor: stream.bg,
    fontFamily: fonts.bodyBold,
    fontSize: 8.5,
    lineHeight: 13,
    letterSpacing: 0.5,
  },
  action: { height: 32, paddingHorizontal: 14, borderWidth: 1, borderRadius: 11, justifyContent: "center" },
  actionText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  noResults: { alignItems: "center", gap: 6, paddingVertical: 40, paddingHorizontal: 24 },
  noResultsTitle: { fontFamily: fonts.display, fontSize: 17, color: stream.ink },
});
