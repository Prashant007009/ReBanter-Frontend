import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setStatusBarStyle } from "expo-status-bar";
import { stream, fonts } from "@/theme/colors";
import { StreamPost } from "@/components/stream/StreamPost";
import { usePostActions } from "@/components/stream/usePostActions";
import { BackIcon } from "@/components/chat/ChatIcons";
import { getDrop } from "@/api/drops";
import type { StreamDrop } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Drop">;

/** One drop on its own (opened from a Roam tile), with the full Stream card actions. */
export function DropScreen({ navigation, route }: Props) {
  const [drops, setDrops] = useState<StreamDrop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { actions, menuFor, followedNow, sheets } = usePostActions(setDrops);

  useEffect(() => {
    getDrop(route.params.dropId)
      .then((d) => setDrops([d]))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't open this drop"));
  }, [route.params.dropId]);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [])
  );

  const drop = drops[0];
  // Hiding it (Not interested / Report) empties the list — go back to where we came from.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (drop) setLoaded(true);
    else if (loaded) navigation.goBack();
  }, [drop, loaded, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>{drop ? `${drop.author.handle}'s ${drop.kind === "take" ? "take" : drop.kind === "poll" ? "poll" : "drop"}` : "Drop"}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {drop ? (
          <StreamPost drop={drop} ring={null} menuOpen={menuFor === drop.id} followedNow={!!followedNow[drop.author.id]} actions={actions} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={stream.lime} />
        )}
      </ScrollView>
      {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 52, paddingBottom: 10, paddingLeft: 6, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: stream.divider },
  back: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 17, color: stream.ink },
  empty: { color: stream.inkMuted, fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: 40, paddingHorizontal: 32 },
});
