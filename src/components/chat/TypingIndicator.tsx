import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { chat } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { PopIn } from "./MessageBubble";
import type { UserSummary } from "@/api/types";

function Dot({ delay }: { delay: number }) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(bounce, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 360, useNativeDriver: true }),
        Animated.delay(480 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, delay]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: bounce.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
          transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
        },
      ]}
    />
  );
}

/** The peer's avatar beside a three-dot "…is typing" bubble, each dot bouncing in sequence. */
export function TypingIndicator({ peer }: { peer: Pick<UserSummary, "handle" | "displayName" | "avatarUrl"> }) {
  return (
    <PopIn style={styles.row}>
      <Avatar handle={peer.handle} displayName={peer.displayName} avatarUrl={peer.avatarUrl} size={28} radius={14} />
      <View style={styles.bubble}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </PopIn>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12 },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: chat.bubbleTheirs,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: chat.dot },
});
