import { memo, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { stream, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import type { Room } from "@/api/types";

const THEMES = [
  { bg: "#C8F169", ink: "#0C0C0E" },
  { bg: "#7B5CFF", ink: "#FFFFFF" },
  { bg: "#FF8A5B", ink: "#0C0C0E" },
  { bg: "#1FB7A6", ink: "#0C0C0E" },
  { bg: "#3E7BFA", ink: "#FFFFFF" },
  { bg: "#FF7AB6", ink: "#0C0C0E" },
];

export function roomTheme(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return THEMES[h % THEMES.length];
}

export function withCommas(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Blinking red "live" dot. */
export function LiveDot({ size = 6 }: { size?: number }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: stream.red, opacity: v }} />;
}

function EqBar({ color, duration }: { color: string; duration: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  // scaleY from the bottom: shift down by half the lost height.
  return (
    <Animated.View
      style={{
        width: 3,
        height: 18,
        borderRadius: 2,
        backgroundColor: color,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [5.85, 0] }) },
          { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
        ],
      }}
    />
  );
}

/** A live room in Roam's carousel: headcount, equaliser, title, host · tag, faces and Join. */
export const RoomCard = memo(function RoomCard({ room, onOpen, onJoin }: { room: Room; onOpen: (room: Room) => void; onJoin: (room: Room) => void }) {
  const theme = roomTheme(room.id);
  return (
    <Pressable style={[styles.card, { backgroundColor: theme.bg }]} onPress={() => onOpen(room)} accessibilityLabel={`Open ${room.title}`}>
      <View style={styles.top}>
        <View style={styles.pill}>
          <LiveDot />
          <Text style={styles.pillText}>{withCommas(room.participantCount)} roaming</Text>
        </View>
        <View style={styles.eq}>
          {[900, 700, 1100, 800].map((d) => (
            <EqBar key={d} color={theme.ink} duration={d} />
          ))}
        </View>
      </View>
      <View style={{ gap: 3 }}>
        <Text style={[styles.title, { color: theme.ink }]} numberOfLines={2}>
          {room.title}
        </Text>
        <Text style={[styles.meta, { color: theme.ink }]} numberOfLines={1}>
          hosted by {room.host.handle}
          {room.tag ? ` · ${room.tag}` : ""}
        </Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.faces}>
          {(room.faces.length ? room.faces : [room.host]).slice(0, 3).map((f) => (
            <View key={f.id} style={[styles.face, { borderColor: theme.bg }]}>
              <Avatar handle={f.handle} displayName={f.displayName} avatarUrl={f.avatarUrl} size={22} radius={11} />
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => onJoin(room)}
          style={[styles.join, { backgroundColor: room.joinedByMe ? "rgba(12,12,14,0.18)" : stream.bg }]}
          accessibilityLabel={room.joinedByMe ? `Leave ${room.title}` : `Join ${room.title}`}
        >
          <Text style={[styles.joinText, { color: room.joinedByMe ? theme.ink : stream.ink }]}>{room.joinedByMe ? "Joined ✓" : "Join"}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { width: 252, height: 150, borderRadius: 24, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, justifyContent: "space-between", overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(12,12,14,0.82)" },
  pillText: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: stream.ink },
  eq: { flexDirection: "row", alignItems: "flex-end", gap: 2.5, height: 18 },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 23, letterSpacing: -0.4 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12.5, opacity: 0.85 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  faces: { flexDirection: "row" },
  face: { marginRight: -8, borderWidth: 2, borderRadius: 13 },
  join: { height: 34, paddingHorizontal: 16, borderRadius: 12, justifyContent: "center" },
  joinText: { fontFamily: fonts.bodySemibold, fontSize: 13.5 },
});
