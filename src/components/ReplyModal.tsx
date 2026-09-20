import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts } from "@/theme/colors";
import { replyToDrop } from "@/api/drops";

export function ReplyModal({ visible, dropId, onClose, onReplied }: { visible: boolean; dropId: string; onClose: () => void; onReplied: () => void }) {
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend() {
    if (!body.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await replyToDrop(dropId, body.trim());
      setBody("");
      onReplied();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that reply");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Reply</Text>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Say something…"
          placeholderTextColor={colors.inkFaint}
          multiline
          autoFocus
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.sendButton} onPress={onSend} disabled={!body.trim() || isSending}>
          {isSending ? <ActivityIndicator color={colors.surfaceRaised} size="small" /> : <Text style={styles.sendText}>Send reply</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(23,20,18,0.4)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 32 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.ink, marginBottom: 12 },
  input: {
    minHeight: 80,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: "top",
  },
  error: { color: colors.cheer, marginTop: 8, fontFamily: fonts.body, fontSize: 12 },
  sendButton: { marginTop: 14, backgroundColor: colors.accent, borderRadius: 999, alignItems: "center", paddingVertical: 13 },
  sendText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.surfaceRaised },
});
