import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { useSession } from "@/session/SessionContext";
import { updateMe } from "@/api/users";

function SettingsRow({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Pressable>
  );
}

export function SettingsScreen() {
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
      <Text style={styles.title}>Settings</Text>

      <View style={styles.accountRow}>
        <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={44} radius={15} />
        <Text style={styles.accountName}>{user.displayName}</Text>
        <Text style={styles.switchLabel}>Switch</Text>
      </View>

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.section}>
        <SettingsRow label="Edit profile" />
        <View style={styles.divider} />
        <SettingsRow label="Who can banter you" value={user.whoCanBanter === "CREW_ONLY" ? "Crew only" : "Everyone"} onPress={toggleWhoCanBanter} />
        <View style={styles.divider} />
        <SettingsRow label="Muted accounts" />
      </View>

      <Text style={styles.sectionLabel}>YOUR TIME</Text>
      <View style={styles.section}>
        <SettingsRow label="Pulse alerts" value="Cheers, replies, crew" />
        <View style={styles.divider} />
        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Wind-down</Text>
            <Text style={styles.rowSubtitle}>Greys the app after 45 min</Text>
          </View>
          <Switch value={!!user.windDownAfterMin} onValueChange={toggleWindDown} disabled={isSaving} />
        </View>
        <View style={styles.divider} />
        <SettingsRow label="Quiet hours" value={user.quietHoursStart ? `${user.quietHoursStart}–${user.quietHoursEnd}` : "Off"} />
      </View>

      <Text style={styles.sectionLabel}>SUPPORT</Text>
      <View style={styles.section}>
        <SettingsRow label="Help centre" />
        <View style={styles.divider} />
        <SettingsRow label="About ReBanter" value="v1.0" />
      </View>

      <Pressable style={styles.logOut} onPress={logOut}>
        <Text style={styles.logOutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 56, paddingHorizontal: 20 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginBottom: 20 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 20, padding: 14, marginBottom: 24 },
  accountName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  switchLabel: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.accent },
  sectionLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: colors.inkFaint, marginBottom: 8 },
  section: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 18, marginBottom: 22, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  rowSubtitle: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  rowValue: { fontFamily: fonts.body, fontSize: 13, color: colors.inkFaint },
  divider: { height: 1, backgroundColor: colors.hairlineSoft, marginLeft: 16 },
  logOut: { alignItems: "center", paddingVertical: 16 },
  logOutText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cheer },
});
