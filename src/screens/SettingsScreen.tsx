import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { Toggle } from "@/components/Toggle";
import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import { useSession } from "@/session/SessionContext";
import { updateMe } from "@/api/users";
import type { RootStackParamList } from "@/navigation/types";

function SettingsRow({ label, value, chevron = true, onPress }: { label: string; value?: string; chevron?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {chevron ? <ChevronRightIcon size={16} color={colors.chevronMuted} /> : null}
    </Pressable>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logOut, refreshMe } = useSession();
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  async function toggleWhoCanBanter() {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateMe({ whoCanBanter: user.whoCanBanter === "CREW_ONLY" ? "EVERYONE" : "CREW_ONLY" });
      await refreshMe();
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleWindDown() {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateMe({ windDownAfterMin: user.windDownAfterMin ? null : 45 });
      await refreshMe();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <ChevronLeftIcon size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.accountRow}>
        <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={48} radius={16} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.accountName}>{user.displayName}</Text>
          <Text style={styles.accountHandle}>@{user.handle} · Personal</Text>
        </View>
        <View style={styles.switchPill}>
          <Text style={styles.switchText}>Switch</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.section}>
        <SettingsRow label="Edit profile" onPress={() => navigation.navigate("EditProfile")} />
        <View style={styles.divider} />
        <SettingsRow label="Who can banter you" value={user.whoCanBanter === "CREW_ONLY" ? "Crew only" : "Everyone"} onPress={toggleWhoCanBanter} />
        <View style={styles.divider} />
        <SettingsRow label="Security & login" />
        <View style={styles.divider} />
        <SettingsRow label="Muted accounts" />
      </View>

      <Text style={styles.sectionLabel}>YOUR TIME</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowLabel}>Pulse alerts</Text>
            <Text style={styles.rowSubtitle}>Cheers, replies, crew</Text>
          </View>
          <Toggle value onChange={() => {}} disabled />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowLabel}>Wind-down</Text>
            <Text style={styles.rowSubtitle}>Greys the app after 45 min</Text>
          </View>
          <Toggle value={!!user.windDownAfterMin} onChange={toggleWindDown} disabled={isSaving} />
        </View>
        <View style={styles.divider} />
        <SettingsRow label="Quiet hours" value={user.quietHoursStart ? `${user.quietHoursStart} – ${user.quietHoursEnd}` : "Off"} />
      </View>

      <Text style={styles.sectionLabel}>SUPPORT</Text>
      <View style={styles.section}>
        <SettingsRow label="Help centre" />
        <View style={styles.divider} />
        <SettingsRow label="About ReBanter" value="v1.0" chevron={false} />
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={logOut}>
          <Text style={styles.logOutText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 56, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: colors.ink, borderRadius: 22, padding: 14, marginBottom: 18, marginHorizontal: -4 },
  accountName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.surfaceRaised },
  accountHandle: { fontFamily: fonts.body, fontSize: 12, color: "#9A938A", marginTop: 2 },
  switchPill: { backgroundColor: "#D9FF7A", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  switchText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
  sectionLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint, marginBottom: 8 },
  section: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 22, marginBottom: 22, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  rowSubtitle: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint, marginTop: 3 },
  rowValue: { fontFamily: fonts.body, fontSize: 13, color: colors.inkFaint },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: 16 },
  logOutText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.danger },
});
