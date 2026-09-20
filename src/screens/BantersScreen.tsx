import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ChevronLeftIcon, SearchIcon, PlusIcon } from "@/assets/icons";
import { PeoplePickerModal } from "@/components/PeoplePickerModal";
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

  const online = banters.flatMap((b) => b.participants).slice(0, 3);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()}>
            <ChevronLeftIcon size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Banters</Text>
        </View>
        <Pressable style={styles.newButton} onPress={() => setPickerVisible(true)}>
          <PlusIcon size={18} color={colors.surfaceRaised} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <SearchIcon size={18} color={colors.inkFaint} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search banters"
          placeholderTextColor={colors.inkFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={[0]}
        keyExtractor={() => "banters-body"}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
        renderItem={() => (
          <View>
            <Text style={styles.sectionLabel}>AROUND NOW</Text>
            <View style={styles.presenceRow}>
              {online.map((p) => (
                <View key={p.id} style={styles.presenceItem}>
                  <View>
                    <Avatar handle={p.handle} displayName={p.displayName} avatarUrl={p.avatarUrl} size={54} radius={19} />
                    <View style={styles.onlineDot} />
                  </View>
                  <Text style={styles.presenceLabel}>{p.handle}</Text>
                </View>
              ))}
              <Pressable style={styles.presenceItem} onPress={() => setPickerVisible(true)}>
                <View style={styles.newTile}>
                  <PlusIcon size={18} color={colors.inkFaint} strokeWidth={2} />
                </View>
                <Text style={styles.presenceLabel}>New</Text>
              </Pressable>
            </View>

            {isLoading ? (
              <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.empty}>No banters yet — start one from a drop or a crewmate's profile.</Text>
            ) : (
              <View style={styles.card}>
                {filtered.map((item, index) => {
                  const other = item.participants[0];
                  const name = item.title ?? other?.displayName ?? "Banter";
                  const preview = item.lastMessage?.body ?? (item.lastMessage ? "Sent a drop" : "Say hi");
                  const unread = !!item.lastMessage && item.lastMessage.senderId !== user?.id && !item.lastMessage.seenAt;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.row, unread && styles.rowUnread, index > 0 && styles.rowDivider]}
                      onPress={() => navigation.navigate("BanterThread", { banterId: item.id, handle: other?.handle ?? "" })}
                    >
                      <Avatar handle={other?.handle ?? "?"} displayName={name} avatarUrl={other?.avatarUrl} size={48} radius={16} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowName}>{name}</Text>
                        <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
                          {preview}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        {item.lastMessage ? <Text style={styles.rowTime}>{dayjs(item.lastMessage.createdAt).fromNow(true)}</Text> : null}
                        {unread ? <View style={styles.unreadDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 20 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  newButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 18,
    height: 46,
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
  sectionLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint, paddingHorizontal: 20, marginBottom: 12 },
  presenceRow: { flexDirection: "row", gap: 16, paddingHorizontal: 20, marginBottom: 20 },
  presenceItem: { alignItems: "center" },
  onlineDot: { position: "absolute", right: -3, bottom: -3, width: 14, height: 14, borderRadius: 999, backgroundColor: colors.success, borderWidth: 3, borderColor: colors.surface },
  presenceLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkMuted, marginTop: 7 },
  newTile: { width: 54, height: 54, borderRadius: 19, backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.dashedBorder, alignItems: "center", justifyContent: "center" },
  card: { marginHorizontal: 16, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 22, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 15, paddingVertical: 14 },
  rowUnread: { backgroundColor: "#FBF9F5" },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  rowPreview: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSubtle, marginTop: 2 },
  rowPreviewUnread: { fontFamily: fonts.bodySemibold, color: colors.ink },
  rowTime: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint },
  unreadDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: colors.accent, marginTop: 8 },
  error: { color: colors.cheer, textAlign: "center", marginTop: 30 },
  empty: { color: colors.inkMuted, textAlign: "center", marginTop: 30, paddingHorizontal: 32 },
});
