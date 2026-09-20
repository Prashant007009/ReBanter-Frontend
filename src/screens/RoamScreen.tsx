import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { getRooms } from "@/api/rooms";
import type { Room } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

export function RoamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Roam</Text>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="People, tags, rooms"
          placeholderTextColor={colors.inkFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <Text style={styles.sectionLabel}>LIVE ROOMS</Text>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={colors.accent} />
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
                  <View style={[styles.dot, { backgroundColor: isLive ? colors.success : colors.cheer }]} />
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
          onRefresh={load}
          refreshing={isLoading}
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
  searchIcon: { color: colors.inkFaint, fontSize: 16 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  sectionLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  roomsRow: { paddingHorizontal: 16, gap: 10 },
  roomCard: { width: 158, height: 116, padding: 14, borderRadius: 22 },
  roomCardLive: { backgroundColor: colors.ink },
  roomCardIdle: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline },
  roomStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  roomStatusLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  roomTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, marginTop: 24 },
  roomCount: { fontFamily: fonts.body, fontSize: 11, marginTop: 8 },
  error: { color: colors.cheer, textAlign: "center", marginTop: 20 },
  empty: { color: colors.inkMuted, paddingHorizontal: 20 },
});
