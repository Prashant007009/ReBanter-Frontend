import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "@/theme/colors";
import { SearchIcon } from "@/assets/icons";
import { Avatar } from "@/components/Avatar";
import { ScreenGradient } from "@/components/ScreenGradient";
import { getRooms } from "@/api/rooms";
import { search, type SearchResults } from "@/api/search";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { Room } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const CHIPS = ["Loops", "Makers", "Food"] as const;

// There's no generic "for you" loops feed yet (out of scope per the
// backend's Rooms & loops issue), so this mirrors the design's single
// placeholder tile rather than faking a feed that doesn't exist server-side.
const FEATURED_LOOP = {
  colors: ["#4B2FE0", "#8C6BFF"] as const,
  duration: "0:14",
  caption: "A quick experiment in motion",
};

export function RoamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("Loops");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getRooms();
      setRooms(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load rooms");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useRefreshOnFocus(load);

  // Debounced live search against the backend as the user types.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await search(trimmed);
        setResults(res);
      } catch {
        setResults({ users: [], rooms: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const isSearchMode = query.trim().length > 0;

  return (
    <ScreenGradient style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Roam</Text>
        <View style={styles.searchBar}>
          <SearchIcon size={18} color={colors.inkMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="People, tags, rooms"
            placeholderTextColor={colors.inkMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>
      </View>

      {isSearchMode ? (
        <FlatList
          data={[0]}
          keyExtractor={() => "search-results"}
          renderItem={() => (
            <View>
              {isSearching ? (
                <ActivityIndicator style={{ marginTop: 20 }} color={colors.accent} />
              ) : !results || (results.users.length === 0 && results.rooms.length === 0) ? (
                <Text style={[styles.empty, { paddingHorizontal: 16 }]}>No results for "{query.trim()}".</Text>
              ) : (
                <>
                  {results.users.length > 0 ? (
                    <>
                      <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginBottom: 10 }]}>People</Text>
                      <View style={styles.resultsCard}>
                        {results.users.map((u, i) => (
                          <Pressable
                            key={u.id}
                            style={[styles.resultRow, i > 0 && styles.resultDivider]}
                            onPress={() => navigation.navigate("UserProfile", { handle: u.handle })}
                          >
                            <Avatar handle={u.handle} displayName={u.displayName} avatarUrl={u.avatarUrl} size={40} radius={14} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.resultName}>{u.displayName}</Text>
                              <Text style={styles.resultHandle}>@{u.handle}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}

                  {results.rooms.length > 0 ? (
                    <>
                      <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginBottom: 10 }]}>Rooms</Text>
                      <View style={styles.resultsCard}>
                        {results.rooms.map((r, i) => (
                          <Pressable
                            key={r.id}
                            style={[styles.resultRow, i > 0 && styles.resultDivider]}
                            onPress={() => navigation.navigate("LoopsPlayer", { roomId: r.id })}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.resultName}>{r.title}</Text>
                              <Text style={styles.resultHandle}>{r.participantCount} roaming</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}
                </>
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={[0]}
          keyExtractor={() => "roam-body"}
          onRefresh={load}
          refreshing={isLoading}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={() => (
            <View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Live Rooms</Text>

                {isLoading ? (
                  <ActivityIndicator style={{ marginVertical: 20 }} color={colors.accent} />
                ) : error ? (
                  <Text style={styles.error}>{error}</Text>
                ) : rooms.length === 0 ? (
                  <Text style={styles.empty}>No rooms yet.</Text>
                ) : (
                  <View style={styles.roomsList}>
                    {rooms.map((room) => {
                      const isLive = room.status === "LIVE";
                      return (
                        <Pressable
                          key={room.id}
                          style={styles.roomRow}
                          onPress={() => navigation.navigate("LoopsPlayer", { roomId: room.id })}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.roomTitle} numberOfLines={1}>
                              {room.title}
                            </Text>
                            <View style={styles.roomStatusRow}>
                              <View style={[styles.dot, { backgroundColor: isLive ? colors.cheer : colors.chevronMuted }]} />
                              <Text style={styles.roomCount}>
                                {room.participantCount} {isLive ? "roaming" : "waiting"}
                              </Text>
                            </View>
                          </View>
                          {isLive ? (
                            <View style={styles.joinButton}>
                              <Text style={styles.joinButtonText}>Join</Text>
                            </View>
                          ) : (
                            <View style={styles.notifyButton}>
                              <Text style={styles.notifyButtonText}>Notify</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>For You</Text>

                <View style={styles.chipsRow}>
                  {CHIPS.map((c) => (
                    <Pressable key={c} onPress={() => setChip(c)} style={[styles.chip, chip === c && styles.chipActive]}>
                      <Text style={[styles.chipText, chip === c && styles.chipTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>

                <LinearGradient
                  colors={FEATURED_LOOP.colors}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={styles.featuredTile}
                >
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationBadgeText}>{FEATURED_LOOP.duration}</Text>
                  </View>
                  <Text style={styles.featuredCaption}>{FEATURED_LOOP.caption}</Text>
                </LinearGradient>
              </View>
            </View>
          )}
        />
      )}
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBlock: { gap: 12, padding: 16 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  searchBar: {
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  section: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  roomsList: { gap: 8 },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  roomTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  roomStatusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  roomCount: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
  joinButton: { backgroundColor: colors.accent, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  joinButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#fff" },
  notifyButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  notifyButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  chipsRow: { flexDirection: "row", gap: 8 },
  chip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  chipTextActive: { color: "#fff" },
  featuredTile: { height: 160, borderRadius: 12, padding: 12, justifyContent: "space-between", overflow: "hidden" },
  durationBadge: { alignSelf: "flex-start", backgroundColor: "rgba(23,20,18,0.67)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  durationBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#fff" },
  featuredCaption: { fontFamily: fonts.display, fontSize: 16, color: "#fff" },
  resultsCard: { marginHorizontal: 16, marginBottom: 18, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 16, overflow: "hidden" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  resultDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  resultName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  resultHandle: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  error: { fontFamily: fonts.body, color: colors.cheer, textAlign: "center", marginVertical: 20 },
  empty: { fontFamily: fonts.body, color: colors.inkMuted, marginTop: 4 },
});
