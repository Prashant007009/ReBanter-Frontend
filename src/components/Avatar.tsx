import { Image, StyleSheet, Text, View } from "react-native";

// Deterministic pastel fallback per handle, echoing the gradient avatar
// tiles in the design for users without a real photo yet.
const PALETTE = ["#F3DCD0", "#DEEBDF", "#E2E4EA", "#F6EBD3", "#EFE6FF"];
const INK_FOR: Record<string, string> = {
  "#F3DCD0": "#94553A",
  "#DEEBDF": "#3D7A5E",
  "#E2E4EA": "#4B5B78",
  "#F6EBD3": "#9A7420",
  "#EFE6FF": "#6D53B8",
};

function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const bg = PALETTE[hash % PALETTE.length];
  return { bg, ink: INK_FOR[bg] };
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
  const borderRadius = radius ?? size * 0.32;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius }}
        accessibilityLabel={displayName}
      />
    );
  }

  const { bg, ink } = paletteFor(handle);
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius, backgroundColor: bg }]}>
      <Text style={{ color: ink, fontWeight: "700", fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});
