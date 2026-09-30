import { forwardRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { stream, fonts } from "@/theme/colors";

// Grid layouts as fractional tracks + cell areas [rowStart, colStart, rowEnd, colEnd]
// (1-based grid lines, like CSS grid-area).
export type CollageLayout = { cols: number[]; rows: number[]; areas: [number, number, number, number][] };

export const COLLAGE_LAYOUTS: CollageLayout[] = [
  { cols: [1, 1], rows: [1, 1], areas: [[1, 1, 2, 2], [1, 2, 2, 3], [2, 1, 3, 2], [2, 2, 3, 3]] },
  { cols: [2, 1], rows: [1, 1], areas: [[1, 1, 3, 2], [1, 2, 2, 3], [2, 2, 3, 3]] },
  { cols: [1, 1], rows: [1], areas: [[1, 1, 2, 2], [1, 2, 2, 3]] },
  { cols: [1], rows: [1, 1], areas: [[1, 1, 2, 2], [2, 1, 3, 2]] },
  { cols: [1, 1, 1], rows: [2, 1], areas: [[1, 1, 2, 4], [2, 1, 3, 2], [2, 2, 3, 3], [2, 3, 3, 4]] },
  {
    cols: [1, 1, 1],
    rows: [1, 1, 1],
    areas: [[1, 1, 2, 2], [1, 2, 2, 3], [1, 3, 2, 4], [2, 1, 3, 2], [2, 2, 3, 3], [2, 3, 3, 4], [3, 1, 4, 2], [3, 2, 4, 3], [3, 3, 4, 4]],
  },
];

export const FRAME_COLORS = ["#0C0C0E", "#F5F3EF", "#C8F169", "#FF7AB6"];
const TINTS = ["#1A2226", "#1C2430", "#2A211C", "#22281A", "#241E2E", "#1E2412", "#2B1E2A", "#15202B", "#23301E"];

/** Position of each cell (px) inside a square of `size` with `gap` between and around cells. */
export function cellRects(layout: CollageLayout, size: number, gap: number) {
  const track = (fr: number[]) => {
    const free = size - gap * (fr.length + 1);
    const total = fr.reduce((a, b) => a + b, 0);
    const lens = fr.map((f) => (free * f) / total);
    const starts: number[] = [];
    let at = gap;
    for (const l of lens) {
      starts.push(at);
      at += l + gap;
    }
    return { starts, lens };
  };
  const c = track(layout.cols);
  const r = track(layout.rows);
  return layout.areas.map(([rs, cs, re, ce]) => {
    const left = c.starts[cs - 1];
    const top = r.starts[rs - 1];
    const right = c.starts[ce - 2] + c.lens[ce - 2];
    const bottom = r.starts[re - 2] + r.lens[re - 2];
    return { left, top, width: right - left, height: bottom - top };
  });
}

/** The collage canvas (also what gets captured and uploaded as one image). */
export const CollageCanvas = forwardRef<View, { layout: CollageLayout; gap: number; frame: string; images: (string | null)[]; onPickCell: (i: number) => void }>(
  function CollageCanvas({ layout, gap, frame, images, onPickCell }, ref) {
    const [size, setSize] = useState(0);
    const rects = size ? cellRects(layout, size, gap) : [];
    return (
      <View ref={ref} collapsable={false} style={[styles.canvas, { backgroundColor: frame }]} onLayout={(e) => setSize(e.nativeEvent.layout.width)}>
        {rects.map((r, i) => (
          <Pressable
            key={i}
            onPress={() => onPickCell(i)}
            style={[styles.cell, r, { borderRadius: Math.max(4, gap * 1.4), backgroundColor: TINTS[i % TINTS.length] }]}
            accessibilityLabel={`Collage cell ${i + 1}`}
          >
            {images[i] ? <Image source={{ uri: images[i]! }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={styles.cellNum}>+ {i + 1}</Text>}
          </Pressable>
        ))}
      </View>
    );
  }
);

/** Mini preview of a layout for the layout picker. */
export function LayoutThumb({ layout, active, onPress }: { layout: CollageLayout; active: boolean; onPress: () => void }) {
  const rects = cellRects(layout, 40, 3);
  return (
    <Pressable onPress={onPress} style={[styles.thumb, { borderColor: active ? stream.lime : "#222228" }]} accessibilityLabel={`Layout with ${layout.areas.length} photos`}>
      <View style={{ width: 40, height: 40 }}>
        {rects.map((r, i) => (
          <View key={i} style={[{ position: "absolute", borderRadius: 3, backgroundColor: active ? stream.lime : "#3A3A42" }, r]} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  canvas: { width: "100%", aspectRatio: 1, borderRadius: 26, overflow: "hidden" },
  cell: { position: "absolute", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  cellNum: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.inkMuted },
  thumb: { width: 58, height: 58, borderWidth: 2, borderRadius: 16, backgroundColor: stream.sheet, alignItems: "center", justifyContent: "center" },
});
