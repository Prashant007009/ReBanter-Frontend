import { memo, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { stream, fonts } from "@/theme/colors";
import { HeartGlyph } from "@/components/stream/StreamIcons";
import { compact, takeTheme } from "@/components/stream/format";
import type { ExploreTile } from "@/api/types";

const COLS = 3;
const ROW_H = 124;
const GAP = 3;
const TINTS = ["#1C2430", "#3A2418", "#1A2226", "#22281A", "#1B2733", "#2B1E2A", "#33241A", "#202024"];

type Placed = { tile: ExploreTile; row: number; col: number; rows: number; cols: number };

/**
 * Pack tiles into a 3-column grid, "dense" like CSS grid-auto-flow: loops are
 * tall (every third one wide instead); each tile takes the first slot it fits.
 */
function pack(tiles: ExploreTile[]): { placed: Placed[]; rows: number } {
  const taken: boolean[][] = [];
  const free = (r: number, c: number) => !taken[r]?.[c];
  let loopIndex = 0;
  const placed: Placed[] = [];
  for (const tile of tiles) {
    let rows = 1;
    let cols = 1;
    if (tile.type === "loop") {
      if (loopIndex % 3 === 2) cols = 2;
      else rows = 2;
      loopIndex++;
    }
    for (let r = 0; ; r++) {
      let spot = -1;
      for (let c = 0; c + cols <= COLS; c++) {
        let fits = true;
        for (let dr = 0; dr < rows && fits; dr++) for (let dc = 0; dc < cols && fits; dc++) fits = free(r + dr, c + dc);
        if (fits) {
          spot = c;
          break;
        }
      }
      if (spot < 0) continue;
      for (let dr = 0; dr < rows; dr++) {
        taken[r + dr] = taken[r + dr] ?? [];
        for (let dc = 0; dc < cols; dc++) taken[r + dr][spot + dc] = true;
      }
      placed.push({ tile, row: r, col: spot, rows, cols });
      break;
    }
  }
  return { placed, rows: taken.length };
}

function duration(sec: number | null) {
  const s = sec ?? 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Roam's For You mosaic: photos, carousels, hot takes and room loops in a packed grid. */
export const Mosaic = memo(function Mosaic({ tiles, onOpen }: { tiles: ExploreTile[]; onOpen: (tile: ExploreTile) => void }) {
  const [width, setWidth] = useState(0);
  const { placed, rows } = useMemo(() => pack(tiles), [tiles]);
  const cell = (width - GAP * (COLS - 1)) / COLS;

  return (
    <View style={{ marginHorizontal: GAP, height: rows * ROW_H + Math.max(0, rows - 1) * GAP }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0
        ? placed.map(({ tile, row, col, rows: rs, cols: cs }, i) => (
            <Pressable
              key={tile.id}
              onPress={() => onOpen(tile)}
              accessibilityLabel={tile.type === "take" ? `Hot take: ${tile.text}` : `${tile.type} by ${tile.author}`}
              style={[
                styles.tile,
                {
                  left: col * (cell + GAP),
                  top: row * (ROW_H + GAP),
                  width: cs * cell + (cs - 1) * GAP,
                  height: rs * ROW_H + (rs - 1) * GAP,
                  backgroundColor: tile.type === "take" ? takeTheme(tile.dropId ?? tile.id).bg : TINTS[i % TINTS.length],
                },
              ]}
            >
              <TileBody tile={tile} />
            </Pressable>
          ))
        : null}
    </View>
  );
});

function TileBody({ tile }: { tile: ExploreTile }) {
  if (tile.type === "take") {
    const ink = takeTheme(tile.dropId ?? tile.id).ink;
    return (
      <View style={styles.take}>
        <Text style={[styles.takeEyebrow, { color: ink }]}>HOT TAKE</Text>
        <Text style={[styles.takeText, { color: ink }]} numberOfLines={4}>
          {tile.text}
        </Text>
      </View>
    );
  }
  return (
    <>
      {tile.imageUrl ? <Image source={{ uri: tile.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {tile.type === "loop" ? (
        <View style={styles.duration} pointerEvents="none">
          <Svg width={9} height={9} viewBox="0 0 24 24" fill={stream.ink}>
            <Path d="M6 3.5l15 8.5-15 8.5z" />
          </Svg>
          <Text style={styles.durationText}>{duration(tile.durationSec)}</Text>
        </View>
      ) : null}
      {tile.type === "carousel" ? (
        <View style={styles.carousel} pointerEvents="none">
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={stream.ink} strokeWidth={2.2} strokeLinejoin="round">
            <Rect x="3" y="7" width="14" height="14" rx="3" />
            <Path d="M7 3h11a3 3 0 0 1 3 3v11" />
          </Svg>
        </View>
      ) : null}
      {tile.type === "loop" && tile.caption ? (
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.72)"]} style={styles.captionShade} pointerEvents="none">
          <Text style={styles.caption} numberOfLines={2}>
            {tile.caption}
          </Text>
          <View style={styles.metaRow}>
            {tile.likes > 0 ? (
              <>
                <HeartGlyph size={11} filled fillColor="#E6E4EA" />
                <Text style={styles.meta}>{compact(tile.likes)} · </Text>
              </>
            ) : null}
            <Text style={styles.meta}>{tile.author}</Text>
          </View>
        </LinearGradient>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  tile: { position: "absolute", borderRadius: 6, overflow: "hidden" },
  take: { flex: 1, padding: 12, justifyContent: "space-between" },
  takeEyebrow: { fontFamily: fonts.bodyBold, fontSize: 9.5, letterSpacing: 1.3 },
  takeText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 18, letterSpacing: -0.3 },
  duration: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(12,12,14,0.8)" },
  durationText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: stream.ink },
  carousel: { position: "absolute", top: 8, right: 8 },
  captionShade: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 26, paddingHorizontal: 10, paddingBottom: 9, gap: 3 },
  caption: { fontFamily: fonts.display, fontSize: 14, lineHeight: 16, color: stream.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: "#E6E4EA" },
});
