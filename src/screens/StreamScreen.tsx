import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { setStatusBarStyle } from "expo-status-bar";
import { stream, fonts, TAB_BAR_CLEARANCE } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { StreamPost } from "@/components/stream/StreamPost";
import { OpenMenuContext, PostCell, usePostActions } from "@/components/stream/usePostActions";
import { MomentRing } from "@/components/stream/MomentRing";
import { MomentViewer } from "@/components/stream/MomentViewer";
import { ChatGlyph, CheckGlyph, PlusGlyph, SearchGlyph } from "@/components/stream/StreamIcons";
import { getFeed } from "@/api/drops";
import { getMoments } from "@/api/moments";
import { getUnreadBanterCount } from "@/api/banters";
import { useSession } from "@/session/SessionContext";
import { realtimeSocket } from "@/realtime/socket";
import type { MomentGroup, StreamDrop, StreamTab } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const TABS: [StreamTab, string][] = [
  ["forYou", "For you"],
  ["following", "Following"],
  ["takes", "Hot takes 🔥"],
];

export function StreamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const [tab, setTab] = useState<StreamTab>("forYou");
  const [drops, setDrops] = useState<StreamDrop[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moments, setMoments] = useState<MomentGroup[]>([]);
  const [viewerGroup, setViewerGroup] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const loadingMoreRef = useRef(false);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const loadFeed = useCallback(async (which: StreamTab) => {
    setError(null);
    try {
      const res = await getFeed(which);
      if (tabRef.current !== which) return;
      setDrops(res.items);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your stream");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadSide = useCallback(() => {
    getMoments()
      .then((res) => setMoments(res.items))
      .catch(() => {});
    getUnreadBanterCount()
      .then((res) => setUnread(res.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setDrops([]);
    loadFeed(tab);
  }, [tab, loadFeed]);

  // Refresh badges and moments whenever Stream comes back into view; the
  // screen is dark, so flip the status bar while it's focused.
  // Coming back (e.g. from a composer) also refreshes the feed so a new post
  // shows up; the first focus is covered by the tab effect above.
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      loadSide();
      if (hasFocused.current) loadFeed(tabRef.current);
      hasFocused.current = true;
      return () => setStatusBarStyle("dark");
    }, [loadSide, loadFeed])
  );

  useEffect(() => {
    const off = realtimeSocket.on("message.new", () => {
      getUnreadBanterCount()
        .then((res) => setUnread(res.count))
        .catch(() => {});
    });
    return () => {
      off();
    };
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const res = await getFeed(tab, nextCursor);
      setDrops((prev) => {
        const seen = new Set(prev.map((d) => d.id));
        return [...prev, ...res.items.filter((d) => !seen.has(d.id))];
      });
      setNextCursor(res.nextCursor);
    } catch {
      // Keep what we have; the next scroll retries.
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }

  function refresh() {
    setIsRefreshing(true);
    loadFeed(tab);
    loadSide();
  }

  const ringByAuthor = useMemo(() => {
    const map = new Map<string, { frames: number; seen: boolean; index: number }>();
    moments.forEach((g, index) => map.set(g.author.id, { frames: g.frames.length, seen: g.allSeen, index }));
    return map;
  }, [moments]);

  const { actions, menuFor, setMenuFor, followedNow, sheets } = usePostActions(setDrops, {
    onOpenMoment: (authorId) => {
      const ring = ringByAuthor.get(authorId);
      if (ring) setViewerGroup(ring.index);
    },
  });

  const markFrameSeen = useCallback((g: number, f: number) => {
    setMoments((prev) =>
      prev.map((group, gi) => {
        if (gi !== g || group.frames[f]?.seen) return group;
        const frames = group.frames.map((fr, fi) => (fi === f ? { ...fr, seen: true } : fr));
        return { ...group, frames, allSeen: frames.every((fr) => fr.seen) };
      })
    );
  }, []);

  const header = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moments}>
        <Pressable style={styles.moment} onPress={() => navigation.navigate("NewMoment")} accessibilityLabel="Add a moment">
          <View>
            <View style={styles.addTile}>
              {user ? <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={52} radius={19} /> : null}
            </View>
            <View style={styles.addBadge}>
              <PlusGlyph size={12} strokeWidth={3.6} />
            </View>
          </View>
          <Text style={styles.momentLabel}>Add</Text>
        </Pressable>
        {moments.map((g, i) => {
          const mine = g.author.id === user?.id;
          return (
            <Pressable key={g.author.id} style={styles.moment} onPress={() => setViewerGroup(i)} accessibilityLabel={`Watch ${g.author.handle}'s moments`}>
              <View>
                <MomentRing size={68} radius={26} frames={g.frames.length} seen={g.allSeen}>
                  <View style={styles.momentAvatar}>
                    <Avatar handle={g.author.handle} displayName={g.author.displayName} avatarUrl={g.author.avatarUrl} size={56} radius={21} />
                  </View>
                </MomentRing>
                {g.live && !g.allSeen ? <Text style={styles.live}>LIVE</Text> : null}
              </View>
              <Text style={[styles.momentLabel, { color: g.allSeen ? stream.inkFaint : stream.ink }]} numberOfLines={1}>
                {mine ? "Your moment" : g.author.handle}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map(([id, label]) => {
          const active = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.tab, { backgroundColor: active ? stream.ink : "transparent", borderColor: active ? stream.ink : stream.raisedBorder }]}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, { color: active ? stream.bg : stream.inkSoft }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const footer = isLoadingMore ? (
    <ActivityIndicator style={{ paddingVertical: 24 }} color={stream.inkMuted} />
  ) : drops.length > 0 && !nextCursor ? (
    <View style={styles.caughtUp}>
      <View style={styles.caughtUpIcon}>
        <CheckGlyph size={22} strokeWidth={2.8} />
      </View>
      <Text style={styles.caughtUpTitle}>You're all caught up</Text>
      <Text style={styles.caughtUpSub}>New posts from your people land here first.</Text>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>
          ReBanter<Text style={{ color: stream.lime }}>.</Text>
        </Text>
        <Pressable style={styles.topButton} onPress={() => navigation.navigate("Tabs", { screen: "Roam" })} accessibilityLabel="Search">
          <SearchGlyph />
        </Pressable>
        <Pressable style={styles.topButton} onPress={() => navigation.navigate("Banters")} accessibilityRole="button" accessibilityLabel="Open banters">
          <ChatGlyph />
          {unread > 0 ? <Text style={styles.badge}>{unread > 9 ? "9+" : unread}</Text> : null}
        </Pressable>
      </View>

      <OpenMenuContext.Provider value={menuFor}>
      <FlatList
        data={isLoading ? [] : drops}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={stream.lime} />
          ) : error ? (
            <Text style={styles.empty}>{error}</Text>
          ) : (
            <Text style={styles.empty}>
              {tab === "following"
                ? "Nothing from your crew yet — follow people from For you."
                : tab === "takes"
                  ? "No hot takes yet. Drop one with the + button."
                  : "No drops yet — your crew's feed will show up here."}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <StreamPost
            drop={item}
            ring={ringByAuthor.get(item.author.id) ?? null}
            menuOpen={menuFor === item.id}
            followedNow={!!followedNow[item.author.id]}
            actions={actions}
          />
        )}
        CellRendererComponent={PostCell}
        extraData={menuFor}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        onScrollBeginDrag={() => menuFor && setMenuFor(null)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={stream.inkMuted} />}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      />
      </OpenMenuContext.Provider>

      <MomentViewer
        groups={moments}
        startGroup={viewerGroup}
        myUserId={user?.id}
        onClose={() => setViewerGroup(null)}
        onFrameSeen={markFrameSeen}
      />
      {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 6, height: 52, marginTop: 44, paddingLeft: 18, paddingRight: 10, backgroundColor: stream.headerGlass, zIndex: 20 },
  wordmark: { flex: 1, fontFamily: fonts.display, fontSize: 27, letterSpacing: -1.1, color: stream.ink },
  topButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: stream.lime,
    color: stream.onLime,
    borderWidth: 2,
    borderColor: stream.bg,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  moments: { gap: 14, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  moment: { width: 70, alignItems: "center", gap: 7 },
  addTile: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#18181C",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#3E3E46",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  addBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: stream.lime,
    borderWidth: 3,
    borderColor: stream.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  momentAvatar: { padding: 3, borderRadius: 23, backgroundColor: stream.bg },
  live: {
    position: "absolute",
    alignSelf: "center",
    bottom: -7,
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: stream.red,
    color: "#fff",
    borderWidth: 2,
    borderColor: stream.bg,
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  momentLabel: { maxWidth: 70, fontFamily: fonts.body, fontSize: 11.5, color: stream.inkMuted },
  tabs: { gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  tab: { height: 32, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: "center" },
  tabText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  empty: { color: stream.inkMuted, fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: 40, paddingHorizontal: 32 },
  caughtUp: { alignItems: "center", gap: 6, paddingTop: 36, paddingBottom: 20, paddingHorizontal: 24 },
  caughtUpIcon: { width: 48, height: 48, borderRadius: 17, borderWidth: 2, borderColor: stream.lime, alignItems: "center", justifyContent: "center" },
  caughtUpTitle: { fontFamily: fonts.display, fontSize: 17, color: stream.ink },
  caughtUpSub: { fontFamily: fonts.body, fontSize: 13, color: stream.inkMuted, textAlign: "center" },
});
