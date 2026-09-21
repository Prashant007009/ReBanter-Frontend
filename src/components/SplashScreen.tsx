import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { brand, colors, fonts } from "@/theme/colors";
import { BanterMark } from "./BanterMark";

// Matches the "Mark & splash" screen in the ReBanter Screens design doc —
// shown while the session is resolving, before the navy in-app theme takes
// over, so it keeps the original violet/ember/bone brand palette.
export function SplashScreen() {
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <View style={styles.center}>
        <BanterMark size={72} withBackground />
        <Text style={styles.brand}>
          ReBanter<Text style={{ color: colors.cheer }}>.</Text>
        </Text>
        <Text style={styles.tagline}>Say it back.</Text>
      </View>

      <View style={styles.footer}>
        <Animated.View style={[styles.progressLine, { opacity: pulse }]} />
        <Text style={styles.footerLabel}>WARMING UP YOUR CREW</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.violet, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  blob: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  blobTop: { width: 340, height: 340, top: -140, right: -100 },
  blobBottom: { width: 300, height: 300, bottom: -120, left: -110 },
  center: { alignItems: "center", gap: 14 },
  brand: { fontFamily: fonts.display, fontSize: 34, color: "#FFFFFF" },
  tagline: { fontFamily: fonts.bodyMedium, fontSize: 15, color: "rgba(255,255,255,0.75)" },
  footer: { position: "absolute", bottom: 64, alignItems: "center", gap: 14 },
  progressLine: { width: 64, height: 3, borderRadius: 999, backgroundColor: "#FFFFFF" },
  footerLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.6)" },
});
