import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts } from "@/theme/colors";
import type { Gif } from "./expressions";

/** App-drawn "GIF": a color card with a sweeping shine and a bobbing caption. */
export function GifCard({ gif, width, height, radius = 18, fontSize = 32, showTag = true, delay = 0 }: {
  gif: Gif;
  width?: number;
  height: number;
  radius?: number;
  fontSize?: number;
  showTag?: boolean;
  delay?: number;
}) {
  const [cardWidth, setCardWidth] = useState(width ?? 0);
  const shine = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shineLoop = Animated.loop(
      Animated.sequence([Animated.delay(delay), Animated.timing(shine, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })])
    );
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    shineLoop.start();
    bobLoop.start();
    return () => {
      shineLoop.stop();
      bobLoop.stop();
    };
  }, [shine, bob, delay]);

  return (
    <View
      style={[styles.card, { width, height, borderRadius: radius, backgroundColor: gif.bg }]}
      onLayout={width ? undefined : (e) => setCardWidth(e.nativeEvent.layout.width)}
    >
      {cardWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-cardWidth, cardWidth] }) }] }]}
        >
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.22)", "transparent"]}
            locations={[0.3, 0.5, 0.7]}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 1, y: 0.6 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <Animated.Text
        style={[
          styles.label,
          { color: gif.ink, fontSize, lineHeight: fontSize * 1.05 },
          {
            transform: [
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
              { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }) },
            ],
          },
        ]}
      >
        {gif.label}
      </Animated.Text>
      {showTag ? <Text style={styles.tag}>GIF</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.display, letterSpacing: -0.5, textAlign: "center", paddingHorizontal: 12 },
  tag: {
    position: "absolute",
    left: 8,
    bottom: 8,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
  },
});
