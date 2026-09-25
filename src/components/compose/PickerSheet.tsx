import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { stream, fonts } from "@/theme/colors";
import { BottomSheet } from "@/components/stream/BottomSheet";
import { CheckGlyph, SearchGlyph } from "@/components/stream/StreamIcons";

export type PickerRow = {
  key: string;
  title: string;
  sub: string;
  glyph: React.ReactNode;
  glyphBg?: string;
  selected: boolean;
  /** Show a little equaliser (the selected sound). */
  playing?: boolean;
  onPress: () => void;
};

function EqBars() {
  const bars = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 300 + i * 100, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 300 + i * 100, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={styles.eq}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.eqBar,
            {
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [5.6, 0] }) },
                { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Composer picker (place / crew / sound / close circle): title + Done, search, selectable rows. */
export function PickerSheet({
  visible,
  title,
  query,
  onQuery,
  rows,
  multi,
  onClose,
  footer,
}: {
  visible: boolean;
  title: string;
  query: string;
  onQuery: (q: string) => void;
  rows: PickerRow[];
  multi?: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} fill>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Pressable style={styles.done} onPress={onClose}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
      <View style={styles.search}>
        <SearchGlyph size={15} color={stream.inkMuted} />
        <TextInput value={query} onChangeText={onQuery} placeholder="Search" placeholderTextColor={stream.inkMuted} style={styles.searchInput} autoCapitalize="none" />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        {rows.length === 0 ? <Text style={styles.empty}>Nothing matches “{query}”.</Text> : null}
        {rows.map((r) => (
          <Pressable key={r.key} onPress={r.onPress} style={[styles.row, r.selected && { backgroundColor: "rgba(200,241,105,0.08)" }]} accessibilityLabel={r.title} accessibilityState={{ selected: r.selected }}>
            <View style={[styles.glyph, { backgroundColor: r.glyphBg ?? stream.raised }]}>{r.glyph}</View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {r.title}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {r.sub}
              </Text>
            </View>
            {r.playing ? <EqBars /> : null}
            <View style={[styles.check, { borderRadius: multi ? 8 : 12, borderColor: r.selected ? stream.lime : "#3A3A42", backgroundColor: r.selected ? stream.lime : "transparent" }]}>
              {r.selected ? <CheckGlyph size={12} color={stream.onLime} strokeWidth={4} /> : null}
            </View>
          </Pressable>
        ))}
        {footer}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontFamily: fonts.display, fontSize: 17, color: stream.ink },
  done: { height: 32, paddingHorizontal: 14, borderRadius: 11, backgroundColor: stream.lime, justifyContent: "center" },
  doneText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.onLime },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: stream.raised },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14, color: stream.ink, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 14 },
  glyph: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  check: { width: 24, height: 24, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  eq: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 16 },
  eqBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: stream.lime },
  empty: { fontFamily: fonts.body, fontSize: 13.5, color: stream.inkMuted, textAlign: "center", paddingVertical: 20 },
});
