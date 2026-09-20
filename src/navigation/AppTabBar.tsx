import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { StreamTabIcon, RoamTabIcon, PulseTabIcon, PlusIcon } from "@/assets/icons";
import { colors, fonts } from "@/theme/colors";
import { useSession } from "@/session/SessionContext";
import { Avatar } from "@/components/Avatar";

const TAB_ICONS = { Stream: StreamTabIcon, Roam: RoamTabIcon, Pulse: PulseTabIcon } as const;

/**
 * Mirrors TabBar.dc.html exactly: Stream / Roam / Drop / Pulse / Me, where
 * "Drop" is a raised center action (opens the composer modal on the root
 * stack) rather than a tab route.
 */
export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { user } = useSession();

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
          <PlusIcon size={19} color={colors.surfaceRaised} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.dropLabel}>Drop</Text>
      </View>

      {state.routes.slice(2).map((route) => {
        const isFocused = state.index === state.routes.indexOf(route);

        if (route.name === "Me") {
          return (
            <View key={route.key} style={styles.slot}>
              <Pressable onPress={() => navigation.navigate(route.name)} style={[styles.pill, isFocused && styles.pillActive]}>
                <View style={[styles.meAvatarRing, { borderColor: isFocused ? colors.accent : colors.inkSubtle }]}>
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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: (color: string, strokeWidth: number) => React.ReactNode;
}) {
  const color = active ? colors.accent : colors.inkSubtle;
  return (
    <View style={styles.slot}>
      <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
        {icon(color, active ? 2.2 : 1.7)}
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
  pillActive: { backgroundColor: colors.accentTint },
  label: { fontSize: 10, fontFamily: fonts.bodyMedium, color: colors.inkSubtle },
  labelActive: { fontFamily: fonts.bodyBold, color: colors.accent },
  meAvatarRing: { width: 23, height: 23, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dropButton: { width: 52, height: 34, borderRadius: 13, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: -3 },
  dropLabel: { fontSize: 10, fontFamily: fonts.bodySemibold, color: colors.ink },
});
