import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

export function ReactionPicker({ visible, onPick, onClose }: { visible: boolean; onPick: (emoji: string) => void; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.tray}>
          {QUICK_REACTIONS.map((emoji) => (
            <Pressable key={emoji} style={styles.emojiButton} onPress={() => onPick(emoji)}>
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(23,20,18,0.3)", alignItems: "center", justifyContent: "center", padding: 32 },
  tray: {
    flexDirection: "row",
    backgroundColor: colors.surfaceRaised,
    borderRadius: 28,
    padding: 8,
    gap: 4,
    shadowColor: "#171412",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  emojiButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  emoji: { fontSize: 26 },
});
