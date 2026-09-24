import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { stream, fonts } from "@/theme/colors";
import { useSession } from "@/session/SessionContext";
import { Avatar } from "@/components/Avatar";
import { BottomSheet } from "@/components/stream/BottomSheet";
import { PlusGlyph, PulseTabGlyph, RoamTabGlyph, StreamTabGlyph } from "@/components/stream/StreamIcons";
import { getPulse } from "@/api/pulse";
import { realtimeSocket } from "@/realtime/socket";

const ICONS = { Stream: StreamTabGlyph, Roam: RoamTabGlyph, Pulse: PulseTabGlyph } as const;

const CREATE_OPTIONS = [
  { key: "post", icon: "📸", label: "Post", sub: "Photos & carousels", primary: true },
  { key: "moment", icon: "⚡", label: "Moment", sub: "Gone in 24h" },
  { key: "take", icon: "🔥", label: "Hot take", sub: "Facts or cap?" },
  { key: "poll", icon: "📊", label: "Poll", sub: "Let them decide" },
] as const;

/**
 * Floating dark tab bar from the Rebanter Stream design: Stream · Roam · (+) ·
 * Pulse · Me. The lime + opens a Create sheet (post, moment, hot take, poll)
 * rather than being a tab. Pulse shows a red dot while notifications are unread.
 */
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { user } = useSession();
  const [hasUnreadPulse, setHasUnreadPulse] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(spin, { toValue: createOpen ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [createOpen, spin]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const check = () => {
      getPulse()
        .then((res) => {
          if (!cancelled) setHasUnreadPulse(res.items.some((n) => !n.read));
        })
        .catch(() => {});
    };
    check();
    const offNew = realtimeSocket.on("notification.new", () => setHasUnreadPulse(true));
    // Recheck on every tab switch (covers "just read Pulse"), plus a light poll.
    const interval = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      offNew();
      clearInterval(interval);
    };
  }, [user, state.index]);

  function pickCreate(key: (typeof CREATE_OPTIONS)[number]["key"]) {
    setCreateOpen(false);
    const root = navigation.getParent() ?? navigation;
    if (key === "post") root.navigate("NewDrop" as never);
    else if (key === "moment") root.navigate("NewMoment" as never);
    else root.navigate(...(["NewTake", { mode: key }] as never as [never]));
  }

  const tab = (routeName: keyof typeof ICONS | "Me") => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    const route = state.routes[index];
    const active = state.index === index;
    const color = active ? stream.lime : stream.inkMuted;
    const Icon = routeName === "Me" ? null : ICONS[routeName];
    return (
      <Pressable
        key={route.key}
        style={styles.item}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={routeName}
      >
        {Icon ? (
          <Icon color={color} />
        ) : (
          <View style={[styles.meRing, { borderColor: active ? stream.lime : "transparent" }]}>
            {user ? <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={22} radius={8} /> : null}
          </View>
        )}
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color }]}>{routeName}</Text>
          {routeName === "Pulse" && hasUnreadPulse ? <View style={styles.dot} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <View style={styles.bar} pointerEvents="box-none">
        {tab("Stream")}
        {tab("Roam")}
        <Pressable onPress={() => setCreateOpen((o) => !o)} accessibilityLabel="Create" accessibilityRole="button">
          <Animated.View
            style={[styles.create, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) }] }]}
          >
            <PlusGlyph />
          </Animated.View>
        </Pressable>
        {tab("Pulse")}
        {tab("Me")}
      </View>

      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="Create">
        <View style={styles.grid}>
          {CREATE_OPTIONS.map((o) => {
            const primary = "primary" in o && o.primary;
            return (
              <Pressable
                key={o.key}
                onPress={() => pickCreate(o.key)}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: primary ? stream.lime : stream.raised },
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
                accessibilityLabel={`New ${o.label}`}
              >
                <Text style={styles.optionIcon}>{o.icon}</Text>
                <View style={{ gap: 2 }}>
                  <Text style={[styles.optionLabel, { color: primary ? stream.onLime : stream.ink }]}>{o.label}</Text>
                  <Text style={[styles.optionSub, { color: primary ? stream.onLime : stream.ink }]}>{o.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 26,
    height: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    borderRadius: 24,
    backgroundColor: stream.navGlass,
    borderWidth: 1,
    borderColor: stream.raisedBorder,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
    elevation: 20,
  },
  item: { width: 62, height: 54, alignItems: "center", justifyContent: "center", gap: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 10.5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: stream.red },
  meRing: { width: 26, height: 26, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  create: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: stream.lime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: stream.lime,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16 },
  option: {
    width: "48.5%",
    flexGrow: 1,
    flexBasis: "45%",
    height: 104,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: stream.sheetBorder,
    padding: 14,
    justifyContent: "space-between",
  },
  optionIcon: { fontSize: 24 },
  optionLabel: { fontFamily: fonts.display, fontSize: 16 },
  optionSub: { fontFamily: fonts.body, fontSize: 12, opacity: 0.8 },
});
