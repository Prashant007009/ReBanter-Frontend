import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ScreenGradient } from "@/components/ScreenGradient";
import { SearchIcon, EditIcon } from "@/assets/icons";
import { PeoplePickerModal } from "@/components/PeoplePickerModal";
import { messagePreview } from "@/components/chat/expressions";
import { getBanters, createBanter } from "@/api/banters";
import { useSession } from "@/session/SessionContext";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { BanterListItem, UserSummary } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

export function BantersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const [banters, setBanters] = useState<BanterListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [startingBanterWith, setStartingBanterWith] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getBanters();
      setBanters(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load Banters");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useRefreshOnFocus(load);

  async function onStartBanter(person: UserSummary) {
    if (startingBanterWith) return;
    setStartingBanterWith(person.id);
    try {
      const banter = await createBanter(person.id);
      setPickerVisible(false);
      navigation.navigate("BanterThread", { banterId: banter.id, handle: person.handle });
    } finally {
      setStartingBanterWith(null);
    }
  }

  const filtered = banters.filter((b) => {
    if (!query.trim()) return true;
    const name = b.title ?? b.participants.map((p) => p.handle).join(" ");
    return name.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <ScreenGradient style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Banters</Text>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>New</Text>
          </View>
        </View>
        <Pressable onPress={() => setPickerVisible(true)}>
          <EditIcon size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <SearchIcon size={16} color={colors.inkMuted} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search banters"
          placeholderTextColor={colors.inkMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusDot} />
        <Text style={styles.statusLabel}>Around now</Text>
      </View>

      <FlatList
        data={[0]}
        keyExtractor={() => "banters-body"}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={() => (
          <View style={styles.list}>
            {isLoading ? (
              <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.empty}>No banters yet — start one from a drop or a crewmate's profile.</Text>
            ) : (
              filtered.map((item) => {
                const other = item.participants[0];
                const name = item.title ?? other?.displayName ?? "Banter";
                const preview = item.lastMessage ? messagePreview(item.lastMessage) : "Say hi";
                const unread = !!item.lastMessage && item.lastMessage.senderId !== user?.id && !item.lastMessage.seenAt;
                return (
                  <Pressable
                    key={item.id}
                    style={styles.row}
                    onPress={() => navigation.navigate("BanterThread", { banterId: item.id, handle: other?.handle ?? "" })}
                  >
                    <Avatar handle={other?.handle ?? "?"} displayName={name} avatarUrl={other?.avatarUrl} size={44} radius={22} />
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName}>{name}</Text>
                        <View style={styles.rowTimeGroup}>
                          <Text style={styles.rowTime}>{item.lastMessage ? dayjs(item.lastMessage.createdAt).fromNow(true) : ""}</Text>
                          {unread ? <View style={styles.unreadDot} /> : null}
                        </View>
                      </View>
                      <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
                        {preview}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        )}
      />

      <PeoplePickerModal
        visible={pickerVisible}
        title="Start a banter"
        onClose={() => setPickerVisible(false)}
        onSelect={onStartBanter}
      />
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  newBadge: { backgroundColor: colors.cheer, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: "#fff", textTransform: "uppercase" },
  searchBar: {
    marginHorizontal: 16,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.cheer },
  statusLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textTransform: "uppercase" },
  list: { paddingHorizontal: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 12,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  rowTimeGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTime: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
  unreadDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.accent },
  rowPreview: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
  rowPreviewUnread: { color: colors.ink },
  error: { fontFamily: fonts.body, color: colors.cheer, textAlign: "center", marginTop: 30 },
  empty: { fontFamily: fonts.body, color: colors.inkMuted, textAlign: "center", marginTop: 30, paddingHorizontal: 32 },
});
