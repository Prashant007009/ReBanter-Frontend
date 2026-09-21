import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { ScreenGradient } from "@/components/ScreenGradient";
import { Avatar } from "@/components/Avatar";
import { DropCard } from "@/components/DropCard";
import { SearchIcon, MessageIcon, PlusIcon } from "@/assets/icons";
import { getFeed } from "@/api/drops";
import { getMyCrew } from "@/api/crew";
import { getPulse } from "@/api/pulse";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { Drop, UserSummary } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

export function StreamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [crewmates, setCrewmates] = useState<UserSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [feed, crew, pulse] = await Promise.all([getFeed(), getMyCrew(), getPulse()]);
      setDrops(feed.items);
      setCrewmates(crew);
      setUnreadCount(pulse.items.filter((n) => !n.read).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your stream");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useRefreshOnFocus(load);

  const activeAuthorIds = useMemo(() => new Set(drops.map((d) => d.author.id)), [drops]);

  return (
    <ScreenGradient style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.wordmark}>ReBanter.</Text>
        <View style={styles.headerIcons}>
          <SearchIcon size={22} color={colors.ink} />
          <Pressable onPress={() => navigation.navigate("Banters")}>
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <MessageIcon size={14} color="#fff" />
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            ) : (
              <MessageIcon size={22} color={colors.ink} />
            )}
          </Pressable>
        </View>
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
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={crewmates}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.stories}
              ListHeaderComponent={
                <Pressable style={styles.storyItem} onPress={() => navigation.navigate("NewDrop")}>
                  <View style={styles.addRing}>
                    <View style={styles.addTile}>
                      <PlusIcon size={16} color={colors.ink} strokeWidth={2.4} />
                    </View>
                  </View>
                  <Text style={styles.storyLabel}>Add</Text>
                </Pressable>
              }
              renderItem={({ item }) => {
                const active = activeAuthorIds.has(item.id);
                return (
                  <View style={styles.storyItem}>
                    <View style={[styles.storyRing, active ? styles.storyRingActive : styles.storyRingIdle]}>
                      <Avatar handle={item.handle} displayName={item.displayName} avatarUrl={item.avatarUrl} size={48} radius={24} />
                    </View>
                    <Text style={styles.storyLabel} numberOfLines={1}>
                      {item.handle}
                    </Text>
                  </View>
                );
              }}
            />
          }
          renderItem={({ item }) => <DropCard drop={item} />}
          ListEmptyComponent={<Text style={styles.empty}>No drops yet — your crew's feed will show up here.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
          onRefresh={load}
          refreshing={isLoading}
        />
      )}
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  info: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  wordmark: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.messageBadge,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 12 },
  stories: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  storyItem: { width: 64, alignItems: "center", gap: 6 },
  addRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  storyRing: { width: 56, height: 56, borderRadius: 28, padding: 3, alignItems: "center", justifyContent: "center" },
  storyRingActive: { borderWidth: 2, borderColor: colors.accent },
  storyRingIdle: { borderWidth: 2, borderColor: colors.hairline },
  storyLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.ink, textAlign: "center" },
  error: { color: colors.cheer, textAlign: "center", marginTop: 40 },
  empty: { color: colors.inkMuted, textAlign: "center", marginTop: 40, paddingHorizontal: 32 },
});
