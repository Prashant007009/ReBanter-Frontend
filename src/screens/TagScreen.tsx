import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setStatusBarStyle } from "expo-status-bar";
import { stream, fonts } from "@/theme/colors";
import { StreamPost } from "@/components/stream/StreamPost";
import { OpenMenuContext, PostCell, usePostActions } from "@/components/stream/usePostActions";
import { BackIcon } from "@/components/chat/ChatIcons";
import { getFeed } from "@/api/drops";
import type { StreamDrop } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Tag">;

/** A hashtag page from Roam: every drop mentioning #tag, as Stream cards. */
export function TagScreen({ navigation, route }: Props) {
  const tag = route.params.tag.replace(/^#/, "");
  const [drops, setDrops] = useState<StreamDrop[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingMore = useRef(false);
  const { actions, menuFor, setMenuFor, followedNow, sheets } = usePostActions(setDrops);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getFeed("forYou", undefined, tag);
      setDrops(res.items);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this tag");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tag]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [])
  );

  async function loadMore() {
    if (!nextCursor || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const res = await getFeed("forYou", nextCursor, tag);
      setDrops((prev) => [...prev, ...res.items.filter((d) => !prev.some((p) => p.id === d.id))]);
      setNextCursor(res.nextCursor);
    } finally {
      loadingMore.current = false;
    }
  }

  const takes = drops.filter((d) => d.kind !== "post").length;
  const posts = drops.length - takes;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <BackIcon />
        </Pressable>
        <View style={styles.tagGlyph}>
          <Text style={styles.tagGlyphText}>#</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            #{tag}
          </Text>
          <Text style={styles.sub}>
            {isLoading ? "Roaming…" : [posts ? `${posts} post${posts === 1 ? "" : "s"}` : null, takes ? `${takes} take${takes === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "Nothing yet"}
            {nextCursor ? "+" : ""}
          </Text>
        </View>
      </View>
      <OpenMenuContext.Provider value={menuFor}>
        <FlatList
          data={drops}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => <StreamPost drop={item} ring={null} menuOpen={menuFor === item.id} followedNow={!!followedNow[item.author.id]} actions={actions} />}
          CellRendererComponent={PostCell}
          extraData={menuFor}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          onScrollBeginDrag={() => menuFor && setMenuFor(null)}
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
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={stream.lime} />
            ) : (
              <Text style={styles.empty}>{error ?? `No one's dropped #${tag} yet. Be the first — add it to a caption.`}</Text>
            )
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </OpenMenuContext.Provider>
      {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 52, paddingBottom: 12, paddingLeft: 6, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: stream.divider },
  back: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  tagGlyph: { width: 40, height: 40, borderRadius: 13, backgroundColor: stream.lime, alignItems: "center", justifyContent: "center" },
  tagGlyphText: { fontFamily: fonts.display, fontSize: 18, color: stream.onLime },
  title: { fontFamily: fonts.display, fontSize: 19, color: stream.ink },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  empty: { color: stream.inkMuted, fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: 40, paddingHorizontal: 32 },
});
