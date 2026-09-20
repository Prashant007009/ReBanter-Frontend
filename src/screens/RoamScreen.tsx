import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "@/theme/colors";
import { SearchIcon } from "@/assets/icons";
import { Avatar } from "@/components/Avatar";
import { getRooms } from "@/api/rooms";
import { search, type SearchResults } from "@/api/search";
import { createBanter } from "@/api/banters";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { Room } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const CHIPS = ["For you", "Loops", "Makers", "Food"] as const;

// Decorative browse-grid tiles — there's no generic content-discovery
// endpoint yet (out of scope per the backend's Rooms & loops issue), so
// this mirrors the design's placeholder gradient tiles rather than faking
// content that doesn't exist server-side.
interface GridTile {
  colors: readonly [string, string];
  tall: boolean;
  label?: string;
}

const GRID_TILES: GridTile[] = [
  { colors: ["#E4DFF8", "#B8ADE9"], tall: true, label: "Loop · 0:14" },
  { colors: ["#F3DCD0", "#E0AF96"], tall: false },
  { colors: ["#DEEBDF", "#AEC8B3"], tall: false },
  { colors: ["#E2E4EA", "#B9BFCB"], tall: false },
  { colors: ["#F6EBD3", "#E2C899"], tall: true },
  { colors: ["#EFE3F5", "#CDB4DC"], tall: false },
];

export function RoamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("For you");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [startingBanterWith, setStartingBanterWith] = useState<string | null>(null);

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

  async function onMessage(userId: string) {
    setStartingBanterWith(userId);
    try {
      const banter = await createBanter(userId);
      const other = results?.users.find((u) => u.id === userId);
      navigation.navigate("BanterThread", { banterId: banter.id, handle: other?.handle ?? "" });
      setQuery("");
    } finally {
      setStartingBanterWith(null);
    }
  }

  const isSearchMode = query.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Roam</Text>

      <View style={styles.searchBar}>
        <SearchIcon size={18} color={colors.inkFaint} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="People, tags, rooms"
          placeholderTextColor={colors.inkFaint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
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
                <Text style={styles.empty}>No results for "{query.trim()}".</Text>
              ) : (
                <>
                  {results.users.length > 0 ? (
                    <>
                      <Text style={styles.sectionLabel}>PEOPLE</Text>
                      <View style={styles.resultsCard}>
                        {results.users.map((u, i) => (
                          <View key={u.id} style={[styles.resultRow, i > 0 && styles.resultDivider]}>
                            <Avatar handle={u.handle} displayName={u.displayName} avatarUrl={u.avatarUrl} size={40} radius={14} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.resultName}>{u.displayName}</Text>
                              <Text style={styles.resultHandle}>@{u.handle}</Text>
                            </View>
                            <Pressable style={styles.messageButton} onPress={() => onMessage(u.id)} disabled={startingBanterWith === u.id}>
                              <Text style={styles.messageButtonText}>{startingBanterWith === u.id ? "…" : "Message"}</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}

                  {results.rooms.length > 0 ? (
                    <>
                      <Text style={styles.sectionLabel}>ROOMS</Text>
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
          renderItem={() => (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>LIVE ROOMS</Text>
                <Text style={styles.seeAll}>See all</Text>
              </View>

              {isLoading ? (
                <ActivityIndicator style={{ marginVertical: 20 }} color={colors.accent} />
              ) : error ? (
                <Text style={styles.error}>{error}</Text>
              ) : (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={rooms}
                  keyExtractor={(r) => r.id}
                  contentContainerStyle={styles.roomsRow}
                  ListEmptyComponent={<Text style={styles.empty}>No rooms yet.</Text>}
                  renderItem={({ item }) => {
                    const isLive = item.status === "LIVE";
                    return (
                      <Pressable
                        style={[styles.roomCard, isLive ? styles.roomCardLive : styles.roomCardIdle]}
                        onPress={() => navigation.navigate("LoopsPlayer", { roomId: item.id })}
                      >
                        <View style={styles.roomStatusRow}>
                          <View style={[styles.dot, { backgroundColor: isLive ? "#9FE8B5" : colors.cheer }]} />
                          <Text style={[styles.roomStatusLabel, { color: isLive ? "#9A938A" : colors.inkFaint }]}>
                            {isLive ? "Live" : "Soon"}
                          </Text>
                        </View>
                        <Text style={[styles.roomTitle, { color: isLive ? colors.surfaceRaised : colors.ink }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={[styles.roomCount, { color: isLive ? "#9A938A" : colors.inkFaint }]}>
                          {item.participantCount} roaming
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}

              <View style={styles.chipsRow}>
                {CHIPS.map((c) => (
                  <Pressable key={c} onPress={() => setChip(c)} style={[styles.chip, chip === c && styles.chipActive]}>
                    <Text style={[styles.chipText, chip === c && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.grid}>
                {GRID_TILES.map((tile, i) => (
                  <LinearGradient
                    key={i}
                    colors={tile.colors}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={[styles.gridTile, tile.tall && styles.gridTileTall]}
                  >
                    {tile.label ? (
                      <View style={styles.gridBadge}>
                        <Text style={styles.gridBadgeText}>{tile.label}</Text>
                      </View>
                    ) : null}
                  </LinearGradient>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 20 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, paddingHorizontal: 20, marginBottom: 14 },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 20,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 10 },
  sectionLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint, paddingHorizontal: 20, marginBottom: 10 },
  seeAll: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.accent },
  roomsRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 20 },
  roomCard: { width: 158, height: 116, padding: 14, borderRadius: 22 },
  roomCardLive: { backgroundColor: colors.ink },
  roomCardIdle: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline },
  roomStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  roomStatusLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  roomTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, marginTop: 24 },
  roomCount: { fontFamily: fonts.body, fontSize: 11, marginTop: 8 },
  chipsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  chip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.ink },
  chipTextActive: { color: colors.surfaceRaised, fontFamily: fonts.bodyBold },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 9 },
  gridTile: { width: "47.7%", height: 112, borderRadius: 22 },
  gridTileTall: { height: 233 },
  gridBadge: { position: "absolute", left: 12, bottom: 12, backgroundColor: "rgba(23,20,18,0.5)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  gridBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#fff" },
  resultsCard: { marginHorizontal: 16, marginBottom: 18, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 22, overflow: "hidden" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  resultDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  resultName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  resultHandle: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  messageButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  messageButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.surfaceRaised },
  error: { color: colors.cheer, textAlign: "center", marginVertical: 20 },
  empty: { color: colors.inkMuted, paddingHorizontal: 20, marginTop: 20 },
});
