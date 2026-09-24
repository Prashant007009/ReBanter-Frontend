import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { stream, fonts } from "@/theme/colors";
import { createDrop } from "@/api/drops";
import { useToast } from "@/components/stream/Toast";
import { CloseGlyph, PlusGlyph } from "@/components/stream/StreamIcons";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "NewTake">;

/** Composer for the two text drops: a Hot take (voted Facts/Cap) or a Poll (2–4 options). */
export function NewTakeScreen({ navigation, route }: Props) {
  const toast = useToast();
  const [mode, setMode] = useState(route.params.mode);
  const [body, setBody] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [caption, setCaption] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const canPost = body.trim().length > 0 && (mode === "take" || filled.length >= 2);

  async function post() {
    if (!canPost || isPosting) return;
    setIsPosting(true);
    setError(null);
    try {
      await createDrop(
        mode === "take"
          ? { kind: "take", body: body.trim(), caption: caption.trim() || undefined }
          : { kind: "poll", body: body.trim(), options: filled, caption: caption.trim() || undefined }
      );
      toast(mode === "take" ? "Hot take is live 🔥" : "Poll is live 📊");
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <View style={styles.segment}>
          {(["take", "poll"] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.segmentButton, mode === m && { backgroundColor: stream.ink }]}>
              <Text style={[styles.segmentText, { color: mode === m ? stream.bg : stream.inkSoft }]}>{m === "take" ? "Hot take" : "Poll"}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.primary, !canPost && styles.primaryOff]} onPress={post} disabled={!canPost || isPosting}>
          {isPosting ? <ActivityIndicator color={stream.onLime} size="small" /> : <Text style={[styles.primaryText, !canPost && { color: stream.inkFaint }]}>Post</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {mode === "take" ? (
          <View style={styles.takeCard}>
            <Text style={styles.eyebrow}>HOT TAKE</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Say the thing everyone's thinking…"
              placeholderTextColor="rgba(255,255,255,0.6)"
              multiline
              maxLength={280}
              style={styles.takeInput}
            />
            <Text style={styles.count}>{body.length}/280 · people vote 🔥 Facts or 🧢 Cap</Text>
          </View>
        ) : (
          <View style={styles.pollCard}>
            <Text style={[styles.eyebrow, { color: stream.lime }]}>POLL</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Ask the group…"
              placeholderTextColor="#8C8A94"
              multiline
              maxLength={200}
              style={styles.questionInput}
            />
            {options.map((o, i) => (
              <View key={i} style={styles.optionRow}>
                <TextInput
                  value={o}
                  onChangeText={(t) => setOptions((prev) => prev.map((p, j) => (j === i ? t : p)))}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor="#8C8A94"
                  maxLength={60}
                  style={styles.optionInput}
                />
                {options.length > 2 ? (
                  <Pressable onPress={() => setOptions((prev) => prev.filter((_, j) => j !== i))} style={styles.removeOption} accessibilityLabel={`Remove option ${i + 1}`}>
                    <CloseGlyph size={18} color={stream.inkMuted} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {options.length < 4 ? (
              <Pressable onPress={() => setOptions((prev) => [...prev, ""])} style={styles.addOption}>
                <PlusGlyph size={16} color={stream.lime} strokeWidth={2.6} />
                <Text style={styles.addOptionText}>Add option</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption (optional)"
          placeholderTextColor="#8C8A94"
          maxLength={500}
          style={styles.captionInput}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg, paddingTop: 52 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: stream.inkMuted },
  segment: { flexDirection: "row", gap: 2, padding: 3, borderRadius: 999, backgroundColor: "#1E1E23" },
  segmentButton: { height: 30, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center" },
  segmentText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  primary: { minWidth: 70, height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: stream.lime, alignItems: "center", justifyContent: "center" },
  primaryOff: { backgroundColor: stream.raisedHover },
  primaryText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.onLime },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  takeCard: { minHeight: 300, borderRadius: 24, backgroundColor: "#7B5CFF", paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, justifyContent: "space-between", gap: 16 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.8, color: "#FFFFFF" },
  takeInput: { flex: 1, minHeight: 170, fontFamily: fonts.display, fontSize: 29, lineHeight: 32, color: "#FFFFFF", textAlignVertical: "top" },
  count: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "rgba(255,255,255,0.8)" },
  pollCard: { borderRadius: 24, backgroundColor: stream.card, borderWidth: 1, borderColor: stream.cardBorder, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 10 },
  questionInput: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: stream.ink, minHeight: 56, textAlignVertical: "top" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  optionInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2E2E35",
    color: stream.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 14.5,
  },
  removeOption: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  addOption: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, alignSelf: "flex-start" },
  addOptionText: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: stream.lime },
  captionInput: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: stream.raised,
    borderWidth: 1,
    borderColor: stream.raisedBorder,
    color: stream.ink,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: stream.redSoft },
});
