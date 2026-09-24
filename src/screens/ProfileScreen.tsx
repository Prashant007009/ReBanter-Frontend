import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, fonts, TAB_BAR_CLEARANCE } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ScreenGradient } from "@/components/ScreenGradient";
import { HamburgerIcon, ZapIcon, ArrowRightIcon, MusicNoteIcon, PinIcon, VideoIcon } from "@/assets/icons";
import type { IconProps } from "@/assets/icons";
import { useSession } from "@/session/SessionContext";
import { apiFetch } from "@/api/client";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { Drop } from "@/api/types";
import { takeTheme } from "@/components/stream/format";
import type { RootStackParamList } from "@/navigation/types";

function GridDotsIcon({ size = 18, color = colors.ink }: IconProps) {
  const dot = Math.round(size * 0.42);
  return (
    <View style={{ width: size, height: size, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignContent: "space-between" }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: dot, height: dot, borderRadius: dot * 0.28, backgroundColor: color }} />
      ))}
    </View>
  );
}

const TABS = [
  { key: "Drops", Icon: GridDotsIcon },
  { key: "Loops", Icon: MusicNoteIcon },
  { key: "Pinned", Icon: PinIcon },
  { key: "Flickers", Icon: VideoIcon },
] as const;
type Tab = (typeof TABS)[number]["key"];

function GridTile({ drop }: { drop: Drop }) {
  const [failed, setFailed] = useState(false);
  const uri = drop.media[0]?.url;
  if (!uri && drop.body) {
    // Hot takes and polls have no photo — show the statement on its card colour.
    const theme = drop.kind === "take" ? takeTheme(drop.id) : { bg: "#16161A", ink: "#F5F3EF" };
    return (
      <View style={[styles.gridTile, styles.gridTileFallback, { backgroundColor: theme.bg, padding: 8 }]}>
        <Text style={{ color: theme.ink, fontFamily: fonts.display, fontSize: 12, lineHeight: 14, textAlign: "center" }} numberOfLines={5}>
          {drop.kind === "poll" ? "📊 " : "🔥 "}
          {drop.body}
        </Text>
      </View>
    );
  }
  if (!uri || failed) return <View style={[styles.gridTile, styles.gridTileFallback]} />;
  return (
    <View style={styles.gridTile}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      {drop.counts.reactions > 0 ? (
        <View style={styles.gridBadge}>
          <ZapIcon size={10} color={colors.surfaceRaised} strokeWidth={2.4} />
          <Text style={styles.gridBadgeText}>{drop.counts.reactions}</Text>
        </View>
      ) : null}
    </View>
  );
}

function openLink(raw: string) {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  Linking.openURL(url).catch(() => {});
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
      const res = await apiFetch<{ items: Drop[] }>(`/api/users/${user.handle}/drops`);
      setMyDrops(res.items);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);
  useRefreshOnFocus(load);

  if (!user) return null;

  return (
    <ScreenGradient style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topBarHandle} numberOfLines={1}>
          @{user.handle}
        </Text>
        <Pressable hitSlop={10} onPress={() => navigation.navigate("Settings")}>
          <HamburgerIcon size={20} color={colors.onDark} strokeWidth={1.9} />
        </Pressable>
      </View>

      <FlatList
        data={tab === "Drops" ? myDrops : []}
        keyExtractor={(d) => d.id}
        numColumns={3}
        key={tab}
        onRefresh={load}
        refreshing={isLoading}
        ListHeaderComponent={
          <View>
            <View style={styles.profileRow}>
              <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={88} radius={30} />
              <View style={styles.statsRow}>
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
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.name} numberOfLines={1}>
                {user.displayName}
              </Text>
              {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
              {user.link ? (
                <Pressable style={styles.linkRow} onPress={() => openLink(user.link!)} hitSlop={6}>
                  <View style={{ transform: [{ rotate: "-45deg" }] }}>
                    <ArrowRightIcon size={12} color={colors.accent} strokeWidth={2.4} />
                  </View>
                  <Text style={styles.link}>{user.link}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.buttonsRow}>
              <Pressable style={styles.actionButton} onPress={() => navigation.navigate("EditProfile")}>
                <Text style={styles.actionButtonText}>Edit profile</Text>
              </Pressable>
              <Pressable
                style={styles.actionButton}
                onPress={() => Share.share({ message: `Come banter with me — @${user.handle} on ReBanter` })}
              >
                <Text style={styles.actionButtonText}>Share profile</Text>
              </Pressable>
            </View>

            <View style={styles.tabs}>
              {TABS.map(({ key, Icon }) => {
                const active = tab === key;
                return (
                  <Pressable key={key} onPress={() => setTab(key)} style={styles.tab} accessibilityLabel={key}>
                    <Icon size={22} color={active ? colors.onDark : colors.onDarkFaint} strokeWidth={1.7} />
                    <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
                  </Pressable>
                );
              })}
            </View>

            {tab === "Drops" && isLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} /> : null}
            {tab === "Drops" && !isLoading && myDrops.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconTile}>
                  <GridDotsIcon size={20} color={colors.onDarkFaint} />
                </View>
                <Text style={styles.emptyTitle}>No drops yet</Text>
                <Text style={styles.emptySubtitle}>Tap the Drop button to share your first one.</Text>
              </View>
            ) : null}
            {tab !== "Drops" ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconTile}>
                  {tab === "Loops" ? (
                    <MusicNoteIcon size={20} color={colors.onDarkFaint} strokeWidth={1.8} />
                  ) : tab === "Pinned" ? (
                    <PinIcon size={20} color={colors.onDarkFaint} strokeWidth={1.8} />
                  ) : (
                    <VideoIcon size={20} color={colors.onDarkFaint} strokeWidth={1.8} />
                  )}
                </View>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptySubtitle}>{tab} you save will show up here.</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <GridTile drop={item} />}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      />
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  topBarHandle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: colors.onDark, flexShrink: 1, marginRight: 12 },
  profileRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 20 },
  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center" },
  statValue: { fontFamily: fonts.display, fontSize: 19, color: colors.onDark },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.onDarkMuted, marginTop: 5 },
  infoBlock: { paddingHorizontal: 20, marginTop: 14 },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onDark },
  bio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.onDarkMuted, marginTop: 4 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  link: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.accent },
  buttonsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 16 },
  actionButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.onDarkHairline,
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onDark },
  tabs: { flexDirection: "row", marginTop: 20, borderTopWidth: 1, borderTopColor: colors.onDarkHairline },
  tab: { flex: 1, alignItems: "center", paddingTop: 13, paddingBottom: 11 },
  tabIndicator: { marginTop: 11, height: 2, width: 26, borderRadius: 1, backgroundColor: "transparent" },
  tabIndicatorActive: { backgroundColor: colors.accent },
  gridTile: { width: "33.33%", aspectRatio: 1, backgroundColor: "rgba(255,255,255,0.08)", margin: 1, borderRadius: 2, overflow: "hidden" },
  gridTileFallback: { alignItems: "center", justifyContent: "center" },
  gridBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(23,20,18,0.5)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  gridBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.surfaceRaised },
  emptyState: { alignItems: "center", paddingTop: 36, paddingHorizontal: 40 },
  emptyIconTile: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.onDarkHairline,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.onDark },
  emptySubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.onDarkMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
});
