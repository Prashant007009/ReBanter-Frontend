import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { DropCard } from "@/components/DropCard";
import { SearchIcon, MessageIcon, PlusIcon } from "@/assets/icons";
import { getFeed } from "@/api/drops";
import { getMyCrews } from "@/api/crew";
import { getPulse } from "@/api/pulse";
import { useSession } from "@/session/SessionContext";
import type { Drop, CrewSummary } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

export function StreamScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [crewmates, setCrewmates] = useState<CrewSummary["members"]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [feed, crews, pulse] = await Promise.all([getFeed(), getMyCrews(), getPulse()]);
      setDrops(feed.items);
      const seen = new Set<string>();
      const members = crews
        .flatMap((c) => c.members)
        .filter((m) => m.id !== user?.id && !seen.has(m.id) && seen.add(m.id));
      setCrewmates(members);
      setUnreadCount(pulse.items.filter((n) => !n.read).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your stream");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const activeAuthorIds = useMemo(() => new Set(drops.map((d) => d.author.id)), [drops]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{dayjs().format("dddd, D MMM").toUpperCase()}</Text>
          <Text style={styles.title}>Stream</Text>
        </View>
        <View style={styles.headerIcons}>
          <SearchIcon size={22} color={colors.ink} />
          <Pressable onPress={() => navigation.navigate("Banters")} style={{ position: "relative" }}>
            <MessageIcon size={22} color={colors.ink} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            ) : null}
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
                <View style={styles.storyItem}>
                  <View style={styles.addTile}>
                    <PlusIcon size={18} color={colors.accent} strokeWidth={2.4} />
                  </View>
                  <Text style={styles.storyLabelMuted}>Add</Text>
                </View>
              }
              renderItem={({ item }) => {
                const active = activeAuthorIds.has(item.id);
                return (
                  <View style={styles.storyItem}>
                    <View style={[styles.storyRing, active ? styles.storyRingActive : styles.storyRingIdle]}>
                      <Avatar handle={item.handle} displayName={item.displayName} avatarUrl={item.avatarUrl} size={55} radius={16} />
                    </View>
                    <Text style={active ? styles.storyLabelActive : styles.storyLabelMuted}>{item.handle}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  date: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, marginTop: 7 },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 9, paddingBottom: 3 },
  badge: {
    position: "absolute",
    top: -5,
    right: -6,
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    backgroundColor: colors.cheer,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 9 },
  stories: { paddingHorizontal: 20, paddingBottom: 18, gap: 10 },
  storyItem: { width: 58, alignItems: "center", marginRight: 10 },
  addTile: {
    width: 58,
    height: 74,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.dashedBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  storyRing: { width: 58, height: 74, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  storyRingActive: { borderWidth: 2.5, borderColor: colors.accent },
  storyRingIdle: { borderWidth: 2, borderColor: colors.hairlineStrong },
  storyLabelActive: { fontFamily: fonts.bodySemibold, fontSize: 10, color: colors.ink, textAlign: "center", marginTop: 7 },
  storyLabelMuted: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkMuted, textAlign: "center", marginTop: 7 },
  error: { color: colors.cheer, textAlign: "center", marginTop: 40 },
  empty: { color: colors.inkMuted, textAlign: "center", marginTop: 40, paddingHorizontal: 32 },
});
