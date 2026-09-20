import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { getRoomLoops, tuneIn, type Loop } from "@/api/rooms";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "LoopsPlayer">;

export function LoopsPlayerScreen({ route }: Props) {
  const { roomId } = route.params;
  const [loops, setLoops] = useState<Loop[]>([]);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tuned, setTuned] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getRoomLoops(roomId);
      setLoops(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this room's loops");
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onTuneIn() {
    setTuned(true);
    try {
      await tuneIn(roomId);
    } catch {
      setTuned(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.surfaceRaised} />
      </View>
    );
  }

  if (error || loops.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{error ?? "No loops in this room yet."}</Text>
      </View>
    );
  }

  const loop = loops[index];
  const cover = loop.media[0];

  return (
    <View style={styles.container}>
      {cover ? (
        <Image source={{ uri: cover.url }} style={StyleSheet.absoluteFillObject} blurRadius={cover.kind === "video" ? 0 : undefined} />
      ) : null}
      <View style={styles.scrim} />

      <View style={styles.topBar}>
        <Text style={styles.roomLabel}>Loops</Text>
        <Text style={styles.optionsIcon}>⋯</Text>
      </View>

      <View style={styles.reactionRail}>
        <Pressable onPress={() => setIndex((i) => Math.min(i + 1, loops.length - 1))}>
          <Text style={styles.reactionIcon}>▲</Text>
        </Pressable>
        <Avatar handle={loop.author.handle} displayName={loop.author.displayName} avatarUrl={loop.author.avatarUrl} size={42} radius={13} />
      </View>

      <View style={styles.bottomOverlay}>
        <View style={styles.authorRow}>
          <Avatar handle={loop.author.handle} displayName={loop.author.displayName} avatarUrl={loop.author.avatarUrl} size={34} radius={12} />
          <Text style={styles.authorHandle}>{loop.author.handle}</Text>
          <Pressable style={styles.tuneInButton} onPress={onTuneIn} disabled={tuned}>
            <Text style={styles.tuneInText}>{tuned ? "Tuned in" : "Tune in"}</Text>
          </Pressable>
        </View>
        {loop.caption ? <Text style={styles.caption}>{loop.caption}</Text> : null}
        {loop.audioLabel ? (
          <View style={styles.audioRow}>
            <Text style={styles.audioIcon}>♫</Text>
            <Text style={styles.audioLabel}>{loop.audioLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#2B2118" },
  center: { flex: 1, backgroundColor: "#2B2118", alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: colors.surfaceRaised, textAlign: "center" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(23,20,18,0.35)" },
  topBar: { position: "absolute", top: 56, left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roomLabel: { fontFamily: fonts.display, fontSize: 19, color: colors.surfaceRaised },
  optionsIcon: { color: colors.surfaceRaised, fontSize: 20 },
  reactionRail: { position: "absolute", right: 16, bottom: 206, alignItems: "center", gap: 20 },
  reactionIcon: { fontSize: 26, color: colors.surfaceRaised },
  bottomOverlay: { position: "absolute", left: 0, right: 80, bottom: 60, paddingHorizontal: 20 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 11 },
  authorHandle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.surfaceRaised },
  tuneInButton: { backgroundColor: colors.surfaceRaised, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  tuneInText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: "rgba(255,253,250,0.9)" },
  audioRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 11 },
  audioIcon: { color: colors.surfaceRaised },
  audioLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "rgba(255,253,250,0.8)" },
});
