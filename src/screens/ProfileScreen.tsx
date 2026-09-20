import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { RepostIcon, HamburgerIcon } from "@/assets/icons";
import { useSession } from "@/session/SessionContext";
import { getFeed } from "@/api/drops";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { Drop } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const TABS = ["Drops", "Loops", "Pinned", "Flickers"] as const;
type Tab = (typeof TABS)[number];

function GridImage({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <View style={[styles.gridTile, styles.gridTileFallback]} />;
  return <Image source={{ uri }} style={styles.gridTile} resizeMode="cover" onError={() => setFailed(true)} />;
}

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
  useRefreshOnFocus(load);

  if (!user) return null;

  const [firstName, ...rest] = user.displayName.split(" ");

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#2B2118", "#6B4F3A", "#C08A62"]} locations={[0, 0.55, 1]} style={styles.cover}>
        <View style={styles.coverTopRow}>
          <Text style={styles.coverHandle}>@{user.handle}</Text>
          <View style={styles.coverIcons}>
            <Pressable hitSlop={10} onPress={() => Share.share({ message: `Come banter with me — @${user.handle} on ReBanter` })}>
              <RepostIcon size={20} color={colors.surfaceRaised} strokeWidth={1.9} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => navigation.navigate("Settings")}>
              <HamburgerIcon size={20} color={colors.surfaceRaised} strokeWidth={1.9} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.coverName}>
          {firstName}
          {rest.length ? `\n${rest.join(" ")}` : ""}
        </Text>
      </LinearGradient>

      <FlatList
        data={tab === "Drops" ? myDrops : []}
        keyExtractor={(d) => d.id}
        numColumns={3}
        key={tab}
        onRefresh={load}
        refreshing={isLoading}
        ListHeaderComponent={
          <View>
            <View style={styles.card}>
              <View style={styles.avatarFloat}>
                <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={74} radius={24} />
              </View>
              {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
              {user.link ? <Text style={styles.link}>{user.link}</Text> : null}

              <View style={styles.stats}>
                <View>
                  <Text style={styles.statValue}>{user.stats.drops}</Text>
                  <Text style={styles.statLabel}>Drops</Text>
                </View>
                <View style={styles.statDivider} />
                <View>
                  <Text style={styles.statValue}>{user.stats.crew}</Text>
                  <Text style={styles.statLabel}>Crew</Text>
                </View>
                <View style={styles.statDivider} />
                <View>
                  <Text style={styles.statValue}>0</Text>
                  <Text style={styles.statLabel}>Tuned in</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <Pressable style={styles.editButton} onPress={() => navigation.navigate("EditProfile")}>
                  <Text style={styles.editButtonText}>Edit profile</Text>
                </Pressable>
                <Pressable
                  style={styles.shareButton}
                  onPress={() => Share.share({ message: `Come banter with me — @${user.handle} on ReBanter` })}
                >
                  <Text style={styles.shareButtonText}>Share card</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.tabs}>
              {TABS.map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={styles.tab}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
                  {tab === t ? <View style={styles.tabIndicator} /> : null}
                </Pressable>
              ))}
            </View>

            {tab === "Drops" && isLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} /> : null}
            {tab === "Drops" && !isLoading && myDrops.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No drops yet</Text>
                <Text style={styles.emptySubtitle}>Tap the Drop button to share your first one.</Text>
              </View>
            ) : null}
            {tab !== "Drops" ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptySubtitle}>{tab} you save will show up here.</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (item.media[0] ? <GridImage uri={item.media[0].url} /> : <View style={styles.gridTile} />)}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  cover: { height: 230, paddingTop: 56, paddingHorizontal: 20 },
  coverTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 34, marginBottom: 8 },
  coverHandle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: "rgba(255,253,250,0.9)" },
  coverIcons: { flexDirection: "row", gap: 16 },
  coverName: { fontFamily: fonts.display, fontSize: 34, lineHeight: 35, letterSpacing: -0.5, color: colors.surfaceRaised, marginTop: 34 },
  card: { marginTop: -74, marginHorizontal: 16, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 26, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16 },
  avatarFloat: { position: "absolute", top: -34, right: 16, borderRadius: 24, borderWidth: 4, borderColor: colors.surfaceRaised },
  bio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: "#3C362F", maxWidth: 250 },
  link: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.accent, marginTop: 6 },
  stats: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 16, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.divider },
  statValue: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSubtle, marginTop: 5 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.divider },
  actionsRow: { flexDirection: "row", gap: 9, marginTop: 15 },
  editButton: { flex: 1, alignItems: "center", backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 13 },
  editButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.surfaceRaised },
  shareButton: { flex: 1, alignItems: "center", backgroundColor: colors.chipMuted, borderRadius: 999, paddingVertical: 13 },
  shareButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  tabs: { flexDirection: "row", gap: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  tab: { alignItems: "center" },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSubtle },
  tabTextActive: { fontFamily: fonts.bodyBold, color: colors.ink },
  tabIndicator: { height: 2, width: "100%", backgroundColor: colors.ink, marginTop: 10 },
  gridTile: { width: "33.33%", aspectRatio: 1, backgroundColor: colors.hairline, margin: 3, borderRadius: 14 },
  gridTileFallback: { alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 40, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.ink },
  emptySubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
});
