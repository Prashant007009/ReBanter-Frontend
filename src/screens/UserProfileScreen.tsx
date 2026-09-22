import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ScreenGradient } from "@/components/ScreenGradient";
import { ChevronLeftIcon, ZapIcon, ArrowRightIcon, MusicNoteIcon, PinIcon, VideoIcon, LockIcon } from "@/assets/icons";
import type { IconProps } from "@/assets/icons";
import { getUserProfile, getUserDrops } from "@/api/users";
import { sendCrewRequest, acceptCrewRequest, skipCrewRequest } from "@/api/crew";
import { createBanter } from "@/api/banters";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { Drop, PublicUserProfile } from "@/api/types";
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

type Props = NativeStackScreenProps<RootStackParamList, "UserProfile">;

export function UserProfileScreen({ route, navigation }: Props) {
  const { handle } = route.params;
  const [tab, setTab] = useState<Tab>("Drops");
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [locked, setLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, d] = await Promise.all([getUserProfile(handle), getUserDrops(handle)]);
      setProfile(p);
      setDrops(d.items);
      setLocked(d.locked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this profile");
    } finally {
      setIsLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);
  useRefreshOnFocus(load);

  async function onAddCrew() {
    if (!profile || isActing) return;
    setIsActing(true);
    try {
      await sendCrewRequest(profile.id);
      setProfile((p) => (p ? { ...p, relationship: "requested" } : p));
    } finally {
      setIsActing(false);
    }
  }

  async function onAccept() {
    if (!profile || isActing) return;
    setIsActing(true);
    try {
      await acceptCrewRequest(profile.id);
      setProfile((p) => (p ? { ...p, relationship: "crew", stats: { ...p.stats, crew: p.stats.crew + 1 } } : p));
      load();
    } finally {
      setIsActing(false);
    }
  }

  async function onDecline() {
    if (!profile || isActing) return;
    setIsActing(true);
    try {
      await skipCrewRequest(profile.id);
      setProfile((p) => (p ? { ...p, relationship: "none" } : p));
    } finally {
      setIsActing(false);
    }
  }

  async function onMessage() {
    if (!profile || isActing) return;
    setIsActing(true);
    try {
      const banter = await createBanter(profile.id);
      navigation.navigate("BanterThread", { banterId: banter.id, handle: profile.handle });
    } finally {
      setIsActing(false);
    }
  }

  return (
    <ScreenGradient style={styles.container}>
      <View style={styles.topBar}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
          <ChevronLeftIcon size={22} color={colors.onDark} />
        </Pressable>
        <Text style={styles.topBarHandle} numberOfLines={1}>
          @{handle}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : error || !profile ? (
        <Text style={styles.error}>{error ?? "This profile couldn't be found."}</Text>
      ) : (
        <FlatList
          data={tab === "Drops" && !locked ? drops : []}
          keyExtractor={(d) => d.id}
          numColumns={3}
          key={tab}
          onRefresh={load}
          refreshing={isLoading}
          ListHeaderComponent={
            <View>
              <View style={styles.profileRow}>
                <Avatar handle={profile.handle} displayName={profile.displayName} avatarUrl={profile.avatarUrl} size={88} radius={30} />
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{profile.stats.drops}</Text>
                    <Text style={styles.statLabel}>Drops</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{profile.stats.crew}</Text>
                    <Text style={styles.statLabel}>Crew</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoBlock}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.displayName}
                </Text>
                {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
                {profile.link ? (
                  <Pressable style={styles.linkRow} onPress={() => openLink(profile.link!)} hitSlop={6}>
                    <View style={{ transform: [{ rotate: "-45deg" }] }}>
                      <ArrowRightIcon size={12} color={colors.accent} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.link}>{profile.link}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.buttonsRow}>
                {profile.relationship === "crew" ? (
                  <Pressable style={styles.primaryButton} onPress={onMessage} disabled={isActing}>
                    <Text style={styles.primaryButtonText}>{isActing ? "…" : "Message"}</Text>
                  </Pressable>
                ) : profile.relationship === "incoming" ? (
                  <>
                    <Pressable style={[styles.primaryButton, { flex: 2 }]} onPress={onAccept} disabled={isActing}>
                      <Text style={styles.primaryButtonText}>Accept crew request</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={onDecline} disabled={isActing}>
                      <Text style={styles.secondaryButtonText}>Decline</Text>
                    </Pressable>
                  </>
                ) : profile.relationship === "requested" ? (
                  <Pressable style={styles.secondaryButton} disabled>
                    <Text style={styles.secondaryButtonText}>Requested</Text>
                  </Pressable>
                ) : profile.relationship === "none" ? (
                  <Pressable style={styles.primaryButton} onPress={onAddCrew} disabled={isActing}>
                    <Text style={styles.primaryButtonText}>{isActing ? "…" : "Add to Crew"}</Text>
                  </Pressable>
                ) : null}
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

              {locked ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconTile}>
                    <LockIcon size={20} color={colors.onDarkFaint} strokeWidth={1.8} />
                  </View>
                  <Text style={styles.emptyTitle}>This account is private</Text>
                  <Text style={styles.emptySubtitle}>Send a crew request to see @{profile.handle}'s drops.</Text>
                </View>
              ) : tab === "Drops" && drops.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconTile}>
                    <GridDotsIcon size={20} color={colors.onDarkFaint} />
                  </View>
                  <Text style={styles.emptyTitle}>No drops yet</Text>
                </View>
              ) : tab !== "Drops" ? (
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
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <GridTile drop={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
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
  topBarHandle: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.onDark, flexShrink: 1 },
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
  primaryButton: { flex: 1, alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 11 },
  primaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.onDarkHairline,
    borderRadius: 10,
    paddingVertical: 11,
  },
  secondaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onDarkMuted },
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
  error: { color: colors.cheer, textAlign: "center", marginTop: 40, paddingHorizontal: 32 },
});
