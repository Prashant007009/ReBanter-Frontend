import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { StreamTabIcon, RoamTabIcon, PulseTabIcon, PlusIcon } from "@/assets/icons";
import { colors, fonts } from "@/theme/colors";
import { useSession } from "@/session/SessionContext";
import { Avatar } from "@/components/Avatar";
import { getPulse } from "@/api/pulse";

const TAB_ICONS = { Stream: StreamTabIcon, Roam: RoamTabIcon, Pulse: PulseTabIcon } as const;

/**
 * Mirrors TabBar.dc.html exactly: Stream / Roam / Drop / Pulse / Me, where
 * "Drop" is a raised center action (opens the composer modal on the root
 * stack) rather than a tab route.
 */
export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { user } = useSession();
  const [hasUnreadPulse, setHasUnreadPulse] = useState(false);

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
    // No realtime push client yet, so poll lightly and also recheck on every
    // tab switch (covers "just read Pulse" and "a new notification landed").
    const interval = setInterval(check, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, state.index]);

  return (
    <View style={styles.container}>
      {state.routes.slice(0, 2).map((route) => {
        const isFocused = state.index === state.routes.indexOf(route);
        const Icon = TAB_ICONS[route.name as keyof typeof TAB_ICONS];
        const label = descriptors[route.key].options.title ?? route.name;
        return (
          <TabSlot
            key={route.key}
            label={label}
            active={isFocused}
            onPress={() => navigation.navigate(route.name)}
            icon={(color, strokeWidth) => <Icon size={20} color={color} strokeWidth={strokeWidth} />}
          />
        );
      })}

      <View style={styles.slot}>
        <Pressable style={styles.dropButton} onPress={() => navigation.navigate("NewDrop" as never)}>
          <PlusIcon size={20} color={colors.surfaceRaised} strokeWidth={2.4} />
        </Pressable>
      </View>

      {state.routes.slice(2).map((route) => {
        const isFocused = state.index === state.routes.indexOf(route);

        if (route.name === "Me") {
          return (
            <View key={route.key} style={styles.slot}>
              <Pressable onPress={() => navigation.navigate(route.name)} style={[styles.pill, isFocused && styles.pillActive]}>
                <View style={[styles.meAvatarRing, { borderColor: isFocused ? colors.accent : colors.inkMuted }]}>
                  {user ? (
                    <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={19} radius={6} />
                  ) : null}
                </View>
              </Pressable>
              <Text style={[styles.label, isFocused && styles.labelActive]}>Me</Text>
            </View>
          );
        }

        const Icon = TAB_ICONS[route.name as keyof typeof TAB_ICONS];
        const label = descriptors[route.key].options.title ?? route.name;
        return (
          <TabSlot
            key={route.key}
            label={label}
            active={isFocused}
            onPress={() => navigation.navigate(route.name)}
            icon={(color, strokeWidth) => <Icon size={20} color={color} strokeWidth={strokeWidth} />}
            badge={route.name === "Pulse" && hasUnreadPulse}
          />
        );
      })}
    </View>
  );
}

function TabSlot({
  label,
  active,
  onPress,
  icon,
  badge,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: (color: string, strokeWidth: number) => React.ReactNode;
  badge?: boolean;
}) {
  const color = active ? colors.accent : colors.inkMuted;
  return (
    <View style={styles.slot}>
      <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
        {icon(color, active ? 2.2 : 1.7)}
        {badge ? <View style={styles.tabDot} /> : null}
      </Pressable>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 88,
    backgroundColor: "rgba(255,253,250,0.96)",
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 11,
    paddingHorizontal: 6,
  },
  slot: { flex: 1, alignItems: "center", gap: 6 },
  pill: { width: 50, height: 28, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  pillActive: {},
  tabDot: {
    position: "absolute",
    top: 3,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.cheer,
    borderWidth: 1.5,
    borderColor: colors.surfaceRaised,
  },
  label: { fontSize: 10, fontFamily: fonts.bodyMedium, color: colors.inkMuted },
  labelActive: { fontFamily: fonts.bodyBold, color: colors.accent },
  meAvatarRing: { width: 23, height: 23, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dropButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cheer, alignItems: "center", justifyContent: "center", marginTop: -7 },
});
