import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { stream } from "@/theme/colors";

/** Minimal draggable slider (tap or drag anywhere on the track). */
export function Slider({
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const set = (x: number) => {
    const w = widthRef.current;
    if (!w) return;
    const t = Math.max(0, Math.min(1, x / w));
    onChange(Math.round(min + t * (max - min)));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
      onPanResponderMove: (e) => set(e.nativeEvent.locationX),
    })
  ).current;
  const pct = (value - min) / Math.max(1, max - min);

  return (
    <View
      style={styles.hit}
      onLayout={(e: LayoutChangeEvent) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      {...pan.panHandlers}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      {width > 0 ? <View pointerEvents="none" style={[styles.thumb, { left: pct * width - 10 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 28, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, backgroundColor: stream.raisedHover, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: stream.lime },
  thumb: { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: stream.lime, borderWidth: 3, borderColor: stream.bg },
});
