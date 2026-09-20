import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ChevronLeftIcon, VideoIcon, MoreHorizontalIcon, CameraIcon, MicIcon, ArrowRightIcon } from "@/assets/icons";
import { getMessages, sendMessage } from "@/api/banters";
import { useSession } from "@/session/SessionContext";
import type { Message } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const QUICK_REPLIES = ["on my way", "send the raw", "ha, fair"];

type Props = NativeStackScreenProps<RootStackParamList, "BanterThread">;

export function BanterThreadScreen({ route, navigation }: Props) {
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

  async function send(body: string) {
    if (!body.trim() || isSending) return;
    setDraft("");
    setIsSending(true);
    try {
      const message = await sendMessage(banterId, body.trim());
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
        <Pressable onPress={() => navigation.goBack()}>
          <ChevronLeftIcon size={22} color={colors.ink} />
        </Pressable>
        <Avatar handle={handle} displayName={handle} size={40} radius={14} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{handle}</Text>
          <Text style={styles.headerStatus}>Around now</Text>
        </View>
        <VideoIcon size={21} color={colors.ink} strokeWidth={1.8} />
        <MoreHorizontalIcon size={21} color={colors.ink} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
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

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={QUICK_REPLIES}
        keyExtractor={(q) => q}
        contentContainerStyle={styles.quickReplies}
        renderItem={({ item }) => (
          <Pressable style={styles.quickReplyChip} onPress={() => send(item)}>
            <Text style={styles.quickReplyText}>{item}</Text>
          </Pressable>
        )}
      />

      <View style={styles.composerRow}>
        <View style={styles.cameraButton}>
          <CameraIcon size={20} color={colors.surfaceRaised} strokeWidth={1.8} />
        </View>
        <View style={styles.composerInput}>
          <TextInput
            style={styles.composerTextInput}
            placeholder="Banter back…"
            placeholderTextColor={colors.inkFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <MicIcon size={19} color={colors.inkFaint} strokeWidth={1.8} />
        </View>
        <Pressable style={styles.sendButton} onPress={() => send(draft)} disabled={!draft.trim() || isSending}>
          <ArrowRightIcon size={20} color={colors.surfaceRaised} strokeWidth={1.9} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 56, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  headerName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  headerStatus: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.success, marginTop: 2 },
  messageList: { padding: 18, gap: 11 },
  bubble: { maxWidth: "72%", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderBottomLeftRadius: 8 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.accent, borderBottomRightRadius: 8 },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  bubbleTime: { fontFamily: fonts.body, fontSize: 10, color: colors.inkFaint, marginTop: 3, marginHorizontal: 4 },
  error: { color: colors.cheer, textAlign: "center", paddingBottom: 6 },
  quickReplies: { paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  quickReplyChip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  quickReplyText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.ink },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 28 },
  cameraButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  composerTextInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 12 },
  sendButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});
