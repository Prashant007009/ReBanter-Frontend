import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setStatusBarStyle } from "expo-status-bar";
import { stream, fonts } from "@/theme/colors";
import { StreamPost } from "@/components/stream/StreamPost";
import { OpenMenuContext, PostCell, usePostActions } from "@/components/stream/usePostActions";
import { BackIcon } from "@/components/chat/ChatIcons";
import { getCollection } from "@/api/me";
import type { StreamDrop } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Collection">;

const COPY = {
  save: { title: "Saved", sub: "Drops you've bookmarked", empty: "Nothing saved yet. Tap the bookmark on any drop to keep it here." },
  cheer: { title: "Your activity", sub: "Drops you've cheered", empty: "You haven't cheered anything yet. Double-tap a drop you love." },
};

/** Me → Saved / Your activity: your bookmarked or cheered drops as Stream cards. */
export function CollectionScreen({ navigation, route }: Props) {
  const { type } = route.params;
  const [drops, setDrops] = useState<StreamDrop[] | null>(null);
  const { actions, menuFor, setMenuFor, followedNow, sheets } = usePostActions(setDrops as never);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      getCollection(type)
        .then((r) => setDrops(r.items))
        .catch(() => setDrops([]));
      return () => setStatusBarStyle("dark");
    }, [type])
  );

  // Un-saving from the Saved list removes it from view.
  const visible = type === "save" ? drops?.filter((d) => d.savedByMe) : drops?.filter((d) => d.likedByMe);
  const copy = COPY[type];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <BackIcon />
        </Pressable>
        <View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.sub}>{copy.sub}</Text>
        </View>
      </View>
      <OpenMenuContext.Provider value={menuFor}>
        <FlatList
          data={visible ?? []}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => <StreamPost drop={item} ring={null} menuOpen={menuFor === item.id} followedNow={!!followedNow[item.author.id]} actions={actions} />}
          CellRendererComponent={PostCell}
          extraData={menuFor}
          onScrollBeginDrag={() => menuFor && setMenuFor(null)}
          ListEmptyComponent={drops === null ? <ActivityIndicator style={{ marginTop: 40 }} color={stream.lime} /> : <Text style={styles.empty}>{copy.empty}</Text>}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </OpenMenuContext.Provider>
      {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 52, paddingBottom: 12, paddingLeft: 6, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: stream.divider },
  back: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 19, color: stream.ink },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  empty: { color: stream.inkMuted, fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: 40, paddingHorizontal: 32 },
});
