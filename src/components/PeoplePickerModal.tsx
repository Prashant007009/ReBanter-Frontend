import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "./Avatar";
import { getMyCrew } from "@/api/crew";
import { useSession } from "@/session/SessionContext";
import type { UserSummary } from "@/api/types";

/** Reusable "pick a crewmate" sheet — used to start a banter or tag crew on a drop. */
export function PeoplePickerModal({
  visible,
  title,
  onClose,
  onSelect,
  selectedIds,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (user: UserSummary) => void;
  selectedIds?: string[];
}) {
  const { user } = useSession();
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    getMyCrew()
      .then((crew) => setPeople(crew.filter((m) => m.id !== user?.id)))
      .finally(() => setIsLoading(false));
  }, [visible, user?.id]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={colors.accent} />
        ) : people.length === 0 ? (
          <Text style={styles.empty}>No crewmates yet.</Text>
        ) : (
          people.map((p, i) => {
            const selected = selectedIds?.includes(p.id);
            return (
              <Pressable key={p.id} style={[styles.row, i > 0 && styles.divider]} onPress={() => onSelect(p)}>
                <Avatar handle={p.handle} displayName={p.displayName} avatarUrl={p.avatarUrl} size={42} radius={14} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{p.displayName}</Text>
                  <Text style={styles.handle}>@{p.handle}</Text>
                </View>
                {selected ? <View style={styles.selectedDot} /> : null}
              </Pressable>
            );
          })
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,14,71,0.5)" },
  sheet: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 40, maxHeight: "70%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.ink },
  close: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  handle: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  selectedDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: colors.ink },
  empty: { color: colors.inkMuted, textAlign: "center", marginVertical: 24 },
});
