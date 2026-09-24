import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { setStatusBarStyle } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { stream, fonts, TAB_BAR_CLEARANCE } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { CommentsModal } from "@/components/CommentsModal";
import { StreamPost, type PostActions } from "@/components/stream/StreamPost";
import { MomentRing } from "@/components/stream/MomentRing";
import { MomentViewer } from "@/components/stream/MomentViewer";
import { ShareSheet } from "@/components/stream/ShareSheet";
import { useToast } from "@/components/stream/Toast";
import { dropLink } from "@/components/stream/format";
import { ChatGlyph, CheckGlyph, PlusGlyph, SearchGlyph } from "@/components/stream/StreamIcons";
import { getFeed, hideDrop, reactToDrop, setStance, unreactToDrop, votePoll } from "@/api/drops";
import { getMoments } from "@/api/moments";
import { getUnreadBanterCount } from "@/api/banters";
import { acceptCrewRequest, sendCrewRequest } from "@/api/crew";
import { useSession } from "@/session/SessionContext";
import { realtimeSocket } from "@/realtime/socket";
import type { MomentGroup, StreamDrop, StreamTab } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const TABS: [StreamTab, string][] = [
  ["forYou", "For you"],
  ["following", "Following"],
  ["takes", "Hot takes 🔥"],
];

// Lift the card whose "…" menu is open above the cards below it (cells are
// siblings, so zIndex has to be set on the cell itself). Context keeps the
// renderer a stable component so cells never remount.
const OpenMenuContext = createContext<string | null>(null);

function PostCell({ item, style, children, ...rest }: { item: StreamDrop; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const openMenu = useContext(OpenMenuContext);
  return (
    <View {...rest} style={[style, item.id === openMenu && { zIndex: 20, elevation: 20 }]}>
      {children}
    </View>
  );
}

export function StreamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<StreamTab>("forYou");
  const [drops, setDrops] = useState<StreamDrop[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moments, setMoments] = useState<MomentGroup[]>([]);
  const [viewerGroup, setViewerGroup] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<StreamDrop | null>(null);
  const [shareFor, setShareFor] = useState<StreamDrop | null>(null);
  const [followedNow, setFollowedNow] = useState<Record<string, boolean>>({});
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

  const patch = useCallback((id: string, fn: (d: StreamDrop) => StreamDrop) => {
    setDrops((prev) => prev.map((d) => (d.id === id ? fn(d) : d)));
  }, []);
  const replace = useCallback((updated: StreamDrop) => patch(updated.id, () => updated), [patch]);

  const ringByAuthor = useMemo(() => {
    const map = new Map<string, { frames: number; seen: boolean; index: number }>();
    moments.forEach((g, index) => map.set(g.author.id, { frames: g.frames.length, seen: g.allSeen, index }));
    return map;
  }, [moments]);

  // Stable handlers so memoised cards don't re-render on every keystroke/scroll.
  const actionsRef = useRef<PostActions>(null as unknown as PostActions);
  actionsRef.current = {
    onLike(drop, force) {
      if (force && drop.likedByMe) return;
      const liked = !drop.likedByMe;
      patch(drop.id, (d) => ({ ...d, likedByMe: liked, counts: { ...d.counts, likes: d.counts.likes + (liked ? 1 : -1) } }));
      (liked ? reactToDrop(drop.id, "cheer") : unreactToDrop(drop.id, "cheer")).catch(() =>
        patch(drop.id, (d) => ({ ...d, likedByMe: !liked, counts: { ...d.counts, likes: d.counts.likes + (liked ? -1 : 1) } }))
      );
    },
    onSave(drop) {
      const saved = !drop.savedByMe;
      setMenuFor(null);
      patch(drop.id, (d) => ({ ...d, savedByMe: saved }));
      toast(saved ? "Saved to your collection" : "Removed from saved");
      (saved ? reactToDrop(drop.id, "save") : unreactToDrop(drop.id, "save")).catch(() => patch(drop.id, (d) => ({ ...d, savedByMe: !saved })));
    },
    onComments(drop) {
      setMenuFor(null);
      setCommentsFor(drop);
    },
    onShare(drop) {
      setMenuFor(null);
      setShareFor(drop);
    },
    async onFollow(drop) {
      const accept = drop.relationship === "incoming";
      setFollowedNow((f) => ({ ...f, [drop.author.id]: true }));
      const next = accept ? "crew" : "requested";
      setDrops((prev) => prev.map((d) => (d.author.id === drop.author.id ? { ...d, relationship: next } : d)));
      try {
        if (accept) await acceptCrewRequest(drop.author.id);
        else await sendCrewRequest(drop.author.id);
        toast(accept ? `You and ${drop.author.handle} are crew now` : `Crew request sent to ${drop.author.handle}`);
      } catch (err) {
        setDrops((prev) => prev.map((d) => (d.author.id === drop.author.id ? { ...d, relationship: drop.relationship } : d)));
        toast(err instanceof Error ? err.message : "Couldn't send that request");
      }
    },
    async onVote(drop, optionId) {
      patch(drop.id, (d) => ({
        ...d,
        poll: d.poll && {
          ...d.poll,
          myVote: optionId,
          totalVotes: d.poll.totalVotes + 1,
          options: d.poll.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
        },
      }));
      try {
        replace(await votePoll(drop.id, optionId));
      } catch {
        patch(drop.id, () => drop);
      }
    },
    async onStance(drop, stance) {
      const next = drop.take?.myStance === stance ? null : stance;
      patch(drop.id, (d) => {
        if (!d.take) return d;
        const t = { ...d.take };
        if (t.myStance) t[t.myStance] -= 1;
        if (next) t[next] += 1;
        return { ...d, take: { ...t, myStance: next } };
      });
      try {
        replace(await setStance(drop.id, next));
      } catch {
        patch(drop.id, () => drop);
      }
    },
    async onCopyLink(drop) {
      setMenuFor(null);
      await Clipboard.setStringAsync(dropLink(drop.id)).catch(() => {});
      toast("Link copied");
    },
    async onHide(drop, report) {
      setMenuFor(null);
      setDrops((prev) => prev.filter((d) => d.id !== drop.id));
      toast(report ? "Reported — thanks for flagging" : "Got it — less like this");
      hideDrop(drop.id, report).catch(() => {});
    },
    onOpenMoment(authorId) {
      const ring = ringByAuthor.get(authorId);
      if (ring) setViewerGroup(ring.index);
    },
    onOpenProfile(handle) {
      if (handle === user?.handle) navigation.navigate("Tabs", { screen: "Me" });
      else navigation.navigate("UserProfile", { handle });
    },
    onToggleMenu(dropId) {
      setMenuFor(dropId);
    },
  };
  const actions = useMemo<PostActions>(
    () => ({
      onLike: (d, f) => actionsRef.current.onLike(d, f),
      onSave: (d) => actionsRef.current.onSave(d),
      onComments: (d) => actionsRef.current.onComments(d),
      onShare: (d) => actionsRef.current.onShare(d),
      onFollow: (d) => actionsRef.current.onFollow(d),
      onVote: (d, o) => actionsRef.current.onVote(d, o),
      onStance: (d, s) => actionsRef.current.onStance(d, s),
      onCopyLink: (d) => actionsRef.current.onCopyLink(d),
      onHide: (d, r) => actionsRef.current.onHide(d, r),
      onOpenMoment: (a) => actionsRef.current.onOpenMoment(a),
      onOpenProfile: (h) => actionsRef.current.onOpenProfile(h),
      onToggleMenu: (id) => actionsRef.current.onToggleMenu(id),
    }),
    []
  );

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
      <CommentsModal
        visible={!!commentsFor}
        dropId={commentsFor?.id ?? ""}
        onClose={() => setCommentsFor(null)}
        onCommented={() => commentsFor && patch(commentsFor.id, (d) => ({ ...d, counts: { ...d.counts, replies: d.counts.replies + 1 } }))}
      />
      <ShareSheet
        drop={shareFor}
        onClose={() => setShareFor(null)}
        onShared={(d) => patch(d.id, (x) => ({ ...x, counts: { ...x.counts, shares: x.counts.shares + 1 } }))}
      />
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
