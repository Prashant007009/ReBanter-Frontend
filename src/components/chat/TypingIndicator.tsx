import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";

function Dot({ delay }: { delay: number }) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(bounce, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, delay]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
      ]}
    />
  );
}

/** The classic three-dot "…is typing" bubble, each dot bouncing in sequence. */
export function TypingIndicator() {
  return (
    <View style={styles.bubble}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#171412",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkMuted },
});
