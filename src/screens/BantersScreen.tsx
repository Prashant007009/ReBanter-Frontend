import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { getBanters } from "@/api/banters";
import type { BanterListItem } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

export function BantersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [banters, setBanters] = useState<BanterListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  const filtered = banters.filter((b) => {
    if (!query.trim()) return true;
    const name = b.title ?? b.participants.map((p) => p.handle).join(" ");
    return name.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Banters</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search banters"
          placeholderTextColor={colors.inkFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          onRefresh={load}
          refreshing={isLoading}
          ListEmptyComponent={<Text style={styles.empty}>No banters yet — start one from a drop or a crewmate's profile.</Text>}
          renderItem={({ item }) => {
            const other = item.participants[0];
            const name = item.title ?? other?.displayName ?? "Banter";
            const preview = item.lastMessage?.body ?? (item.lastMessage ? "Sent a drop" : "Say hi");
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate("BanterThread", { banterId: item.id, handle: other?.handle ?? "" })}
              >
                <Avatar handle={other?.handle ?? "?"} displayName={name} avatarUrl={other?.avatarUrl} size={48} radius={16} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{name}</Text>
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {preview}
                  </Text>
                </View>
                {item.lastMessage ? (
                  <Text style={styles.rowTime}>{dayjs(item.lastMessage.createdAt).fromNow(true)}</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 20 },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
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
  searchIcon: { color: colors.inkFaint, fontSize: 16 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 20, paddingVertical: 12 },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  rowPreview: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSubtle, marginTop: 2 },
  rowTime: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint },
  error: { color: colors.cheer, textAlign: "center", marginTop: 30 },
  empty: { color: colors.inkMuted, textAlign: "center", marginTop: 30, paddingHorizontal: 32 },
});
