import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { DropCard } from "@/components/DropCard";
import { getFeed } from "@/api/drops";
import { getMyCrews } from "@/api/crew";
import { useSession } from "@/session/SessionContext";
import type { Drop, CrewSummary } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

export function StreamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [crewmates, setCrewmates] = useState<CrewSummary["members"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [feed, crews] = await Promise.all([getFeed(), getMyCrews()]);
      setDrops(feed.items);
      const seen = new Set<string>();
      const members = crews
        .flatMap((c) => c.members)
        .filter((m) => m.id !== user?.id && !seen.has(m.id) && seen.add(m.id));
      setCrewmates(members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your stream");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{dayjs().format("dddd, D MMM").toUpperCase()}</Text>
          <Text style={styles.title}>Stream</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("Banters")} style={styles.inboxButton}>
          <Text style={styles.inboxIcon}>✉</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={drops}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            crewmates.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={crewmates}
                keyExtractor={(m) => m.id}
                contentContainerStyle={styles.stories}
                renderItem={({ item }) => (
                  <View style={styles.storyItem}>
                    <Avatar handle={item.handle} displayName={item.displayName} avatarUrl={item.avatarUrl} size={58} radius={18} />
                    <Text style={styles.storyLabel}>{item.handle}</Text>
                  </View>
                )}
              />
            ) : null
          }
          renderItem={({ item }) => <DropCard drop={item} />}
          ListEmptyComponent={<Text style={styles.empty}>No drops yet — your crew's feed will show up here.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
          onRefresh={load}
          refreshing={isLoading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 16 },
  date: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, marginTop: 6 },
  inboxButton: { padding: 8 },
  inboxIcon: { fontSize: 20, color: colors.ink },
  stories: { paddingHorizontal: 20, paddingBottom: 18, gap: 10 },
  storyItem: { width: 58, alignItems: "center" },
  storyLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkMuted, marginTop: 7 },
  error: { color: colors.cheer, textAlign: "center", marginTop: 40 },
  empty: { color: colors.inkMuted, textAlign: "center", marginTop: 40, paddingHorizontal: 32 },
});
