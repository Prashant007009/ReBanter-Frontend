import { useState } from "react";
import { Image, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts } from "@/theme/colors";

// Exact avatar gradient/ink pairs pulled from the design (145deg stops).
const PALETTE = [
  { stops: ["#F3DCD0", "#D9AE97"] as const, ink: "#94553A" }, // peach
  { stops: ["#DEEBDF", "#AEC8B3"] as const, ink: "#3D7A5E" }, // green
  { stops: ["#E2E4EA", "#BFC6D2"] as const, ink: "#4B5B78" }, // grey
  { stops: ["#F6EBD3", "#E2C899"] as const, ink: "#9A7420" }, // gold
  { stops: ["#EFE6FF", "#D3C4F7"] as const, ink: "#6D53B8" }, // purple
] as const;

function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({
  handle,
  displayName,
  avatarUrl,
  size = 40,
  radius,
}: {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  size?: number;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const borderRadius = radius ?? size * 0.32;

  if (avatarUrl && !failed) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius }}
        accessibilityLabel={displayName}
        onError={() => setFailed(true)}
      />
    );
  }

  const { stops, ink } = paletteFor(handle);
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <LinearGradient
      colors={stops}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.fallback, { width: size, height: size, borderRadius }]}
    >
      <Text style={{ color: ink, fontFamily: fonts.bodyBold, fontSize: size * 0.36 }}>{initials}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});
