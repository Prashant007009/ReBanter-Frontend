import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { getMessages, sendMessage } from "@/api/banters";
import { useSession } from "@/session/SessionContext";
import type { Message } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "BanterThread">;

export function BanterThreadScreen({ route }: Props) {
  const { banterId, handle } = route.params;
  const { user } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getMessages(banterId);
      setMessages(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this banter");
    } finally {
      setIsLoading(false);
    }
  }, [banterId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSend() {
    const body = draft.trim();
    if (!body || isSending) return;
    setDraft("");
    setIsSending(true);
    try {
      const message = await sendMessage(banterId, body);
      setMessages((prev) => [...prev, message]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message didn't send");
      setDraft(body);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{handle}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 18, gap: 11 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: colors.surfaceRaised }]}>{item.body}</Text>
                </View>
                <Text style={styles.bubbleTime}>{dayjs(item.createdAt).format("H:mm")}</Text>
              </View>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composerRow}>
        <TextInput
          style={styles.composerInput}
          placeholder="Banter back…"
          placeholderTextColor={colors.inkFaint}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={onSend} disabled={!draft.trim() || isSending}>
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingTop: 56, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  headerTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  bubble: { maxWidth: "72%", padding: 12, borderRadius: 22 },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderBottomLeftRadius: 8 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.accent, borderBottomRightRadius: 8 },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  bubbleTime: { fontFamily: fonts.body, fontSize: 10, color: colors.inkFaint, marginTop: 3, marginHorizontal: 4 },
  error: { color: colors.cheer, textAlign: "center", paddingBottom: 6 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 18 },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  sendButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  sendIcon: { color: colors.surfaceRaised, fontSize: 16 },
});
