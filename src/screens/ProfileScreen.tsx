import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { useSession } from "@/session/SessionContext";
import { getFeed } from "@/api/drops";
import type { Drop } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const TABS = ["Drops", "Loops", "Pinned", "Flickers"] as const;
type Tab = (typeof TABS)[number];

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("Drops");
  const [myDrops, setMyDrops] = useState<Drop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getFeed();
      setMyDrops(res.items.filter((d) => d.author.id === user.id));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.cover} />
      <View style={styles.headerCard}>
        <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={78} radius={24} />
        <Text style={styles.name}>{user.displayName}</Text>
        <Text style={styles.handle}>@{user.handle}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        {user.link ? <Text style={styles.link}>{user.link}</Text> : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{user.stats.drops}</Text>
            <Text style={styles.statLabel}>Drops</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{user.stats.crew}</Text>
            <Text style={styles.statLabel}>Crew</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Tuned in</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.editButton} onPress={() => navigation.navigate("Settings")}>
            <Text style={styles.editButtonText}>Edit profile</Text>
          </Pressable>
          <Pressable style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Share card</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} style={styles.tab} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        ))}
      </View>

      {tab === "Drops" ? (
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.accent} />
        ) : (
          <FlatList
            data={myDrops}
            keyExtractor={(d) => d.id}
            numColumns={3}
            contentContainerStyle={{ padding: 2 }}
            ListEmptyComponent={<Text style={styles.empty}>No drops yet.</Text>}
            renderItem={({ item }) =>
              item.media[0] ? <Image source={{ uri: item.media[0].url }} style={styles.gridTile} /> : <View style={styles.gridTile} />
            }
          />
        )
      ) : (
        <Text style={styles.empty}>Nothing here yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  cover: { height: 100, backgroundColor: colors.ink },
  headerCard: { alignItems: "center", marginTop: -40, paddingHorizontal: 24, paddingBottom: 18 },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginTop: 12 },
  handle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  bio: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, textAlign: "center", marginTop: 8 },
  link: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.accent, marginTop: 6 },
  stats: { flexDirection: "row", gap: 28, marginTop: 18 },
  stat: { alignItems: "center" },
  statValue: { fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  editButton: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  editButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.surfaceRaised },
  shareButton: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  shareButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  tabs: { flexDirection: "row", justifyContent: "space-around", borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft, paddingBottom: 10 },
  tab: { alignItems: "center", gap: 6 },
  tabText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.inkFaint },
  tabTextActive: { color: colors.ink },
  tabIndicator: { width: 20, height: 2, backgroundColor: colors.accent, borderRadius: 999 },
  gridTile: { width: "33.33%", aspectRatio: 1, backgroundColor: colors.hairline, margin: 1 },
  empty: { color: colors.inkMuted, textAlign: "center", marginTop: 30 },
});
