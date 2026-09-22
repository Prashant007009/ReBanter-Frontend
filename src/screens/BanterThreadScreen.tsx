import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ScreenGradient } from "@/components/ScreenGradient";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { DateSeparator } from "@/components/chat/DateSeparator";
import { ImageViewerModal } from "@/components/chat/ImageViewerModal";
import { ChevronLeftIcon, VideoIcon, MoreHorizontalIcon, CameraIcon, SmileIcon, ArrowRightIcon } from "@/assets/icons";
import { getMessages, sendMessage, sendTyping, reactToMessage, unreactToMessage } from "@/api/banters";
import { uploadLocalAsset } from "@/api/media";
import { useSession } from "@/session/SessionContext";
import { realtimeSocket } from "@/realtime/socket";
import type { Message } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const QUICK_REPLIES = ["on my way", "send the raw", "ha, fair"];
const STICKERS = ["😂", "❤️", "😍", "🔥", "👏", "😢", "😮", "🎉", "🙌", "😎", "🤔", "👍", "💯", "😭", "🥳", "🙏"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
const TYPING_SEND_INTERVAL_MS = 2000;
const TYPING_EXPIRE_MS = 3000;

type Row = { kind: "date"; key: string; createdAt: string } | { kind: "message"; key: string; item: Message; isFirstInGroup: boolean; isLastInGroup: boolean };

type Props = NativeStackScreenProps<RootStackParamList, "BanterThread">;

export function BanterThreadScreen({ route, navigation }: Props) {
  const { banterId, handle } = route.params;
  const { user } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Row>>(null);
  const lastTypingSentAt = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateNext = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
  }, []);

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

  // Live incoming messages, typing, read receipts, and reactions for this thread.
  useEffect(() => {
    realtimeSocket.connect();
    const offMessage = realtimeSocket.on("message.new", (payload) => {
      const message = payload as Message;
      if (message.banterId !== banterId) return;
      setOtherTyping(false);
      animateNext();
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    const offTyping = realtimeSocket.on("typing", (payload) => {
      const { banterId: eventBanterId } = payload as { banterId: string; userId: string };
      if (eventBanterId !== banterId) return;
      setOtherTyping(true);
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      typingClearTimer.current = setTimeout(() => setOtherTyping(false), TYPING_EXPIRE_MS);
    });
    const offSeen = realtimeSocket.on("message.seen", (payload) => {
      const { banterId: eventBanterId, seenAt } = payload as { banterId: string; seenAt: string };
      if (eventBanterId !== banterId) return;
      setMessages((prev) => prev.map((m) => (m.senderId === user?.id && !m.seenAt ? { ...m, seenAt } : m)));
    });
    const offReaction = realtimeSocket.on("message.reaction", (payload) => {
      const { messageId, reactions } = payload as { messageId: string; reactions: Message["reactions"] };
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });
    return () => {
      offMessage();
      offTyping();
      offSeen();
      offReaction();
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      realtimeSocket.disconnect();
    };
  }, [banterId, user?.id, animateNext]);

  function onDraftChange(text: string) {
    setDraft(text);
    const now = Date.now();
    if (text.trim() && now - lastTypingSentAt.current > TYPING_SEND_INTERVAL_MS) {
      lastTypingSentAt.current = now;
      sendTyping(banterId).catch(() => {});
    }
  }

  async function send(input: { body?: string; imageUrl?: string; kind?: "text" | "image" | "sticker" }) {
    if (isSending) return;
    setIsSending(true);
    setStickersOpen(false);
    try {
      const message = await sendMessage(banterId, input);
      animateNext();
      setMessages((prev) => [...prev, message]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message didn't send");
    } finally {
      setIsSending(false);
    }
  }

  async function sendText(body: string) {
    if (!body.trim()) return;
    setDraft("");
    await send({ body: body.trim(), kind: "text" });
  }

  function sendSticker(emoji: string) {
    send({ body: emoji, kind: "sticker" });
  }

  async function pickAndSendImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to send a photo");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setError("That photo is over 2MB — pick a smaller one");
      return;
    }

    setError(null);
    setIsUploadingImage(true);
    try {
      const contentType = asset.mimeType ?? "image/jpeg";
      const uploaded = await uploadLocalAsset(asset.uri, contentType);
      await send({ imageUrl: uploaded, kind: "image" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo didn't send");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function onReact(messageId: string, emoji: string) {
    animateNext();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, reactions: [...m.reactions.filter((r) => r.userId !== user?.id), { id: `local-${messageId}`, userId: user!.id, emoji }] }
          : m
      )
    );
    reactToMessage(messageId, emoji).catch(() => load());
  }

  function onUnreact(messageId: string) {
    animateNext();
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: m.reactions.filter((r) => r.userId !== user?.id) } : m)));
    unreactToMessage(messageId).catch(() => load());
  }

  const lastMineSeenId = useMemo(() => {
    const last = messages[messages.length - 1];
    return last && last.senderId === user?.id && last.seenAt ? last.id : null;
  }, [messages, user?.id]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    messages.forEach((item, i) => {
      const prev = messages[i - 1];
      if (!prev || !dayjs(prev.createdAt).isSame(dayjs(item.createdAt), "day")) {
        out.push({ kind: "date", key: `date-${item.id}`, createdAt: item.createdAt });
      }
      const next = messages[i + 1];
      const isFirstInGroup = !prev || prev.senderId !== item.senderId || out[out.length - 1]?.kind === "date";
      const isLastInGroup = !next || next.senderId !== item.senderId || !dayjs(next.createdAt).isSame(dayjs(item.createdAt), "day");
      out.push({ kind: "message", key: item.id, item, isFirstInGroup, isLastInGroup });
    });
    return out;
  }, [messages]);

  return (
    <ScreenGradient style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.headerIconButton} onPress={() => navigation.goBack()}>
            <ChevronLeftIcon size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.headerAvatarRing}>
            <Avatar handle={handle} displayName={handle} size={40} radius={14} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{handle}</Text>
            <Text style={[styles.headerStatus, otherTyping && styles.headerStatusTyping]}>
              {otherTyping ? "typing…" : "Around now"}
            </Text>
          </View>
          <Pressable style={styles.headerIconButton}>
            <VideoIcon size={20} color={colors.ink} strokeWidth={1.8} />
          </Pressable>
          <Pressable style={styles.headerIconButton}>
            <MoreHorizontalIcon size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.messageArea}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Avatar handle={handle} displayName={handle} size={72} radius={26} />
              <Text style={styles.emptyTitle}>{handle}</Text>
              <Text style={styles.emptySubtitle}>Say hi — this is the start of your banter.</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={rows}
              keyExtractor={(row) => row.key}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListFooterComponent={
                otherTyping ? (
                  <View style={{ marginTop: 8 }}>
                    <TypingIndicator />
                  </View>
                ) : null
              }
              renderItem={({ item: row }) =>
                row.kind === "date" ? (
                  <DateSeparator createdAt={row.createdAt} />
                ) : (
                  <MessageBubble
                    message={row.item}
                    mine={row.item.senderId === user?.id}
                    isFirstInGroup={row.isFirstInGroup}
                    isLastInGroup={row.isLastInGroup}
                    currentUserId={user?.id}
                    seenLabel={row.item.id === lastMineSeenId ? `Seen ${dayjs(row.item.seenAt!).format("H:mm")}` : null}
                    onReact={onReact}
                    onUnreact={onUnreact}
                    onImagePress={setViewerUri}
                  />
                )
              }
            />
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {stickersOpen ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={STICKERS}
            keyExtractor={(s) => s}
            contentContainerStyle={styles.quickReplies}
            renderItem={({ item }) => (
              <Pressable style={styles.stickerChip} onPress={() => sendSticker(item)}>
                <Text style={styles.stickerChipText}>{item}</Text>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={QUICK_REPLIES}
            keyExtractor={(q) => q}
            contentContainerStyle={styles.quickReplies}
            renderItem={({ item }) => (
              <Pressable style={styles.quickReplyChip} onPress={() => sendText(item)}>
                <Text style={styles.quickReplyText}>{item}</Text>
              </Pressable>
            )}
          />
        )}

        <View style={styles.composerRow}>
          <Pressable style={styles.composerSideButton} onPress={pickAndSendImage} disabled={isUploadingImage}>
            {isUploadingImage ? <ActivityIndicator size="small" color={colors.ink} /> : <CameraIcon size={22} color={colors.ink} strokeWidth={1.7} />}
          </Pressable>
          <View style={styles.composerPill}>
            <TextInput
              style={styles.composerTextInput}
              placeholder="Banter back…"
              placeholderTextColor={colors.inkFaint}
              value={draft}
              onChangeText={onDraftChange}
              multiline
            />
            <Pressable style={styles.composerSideButton} onPress={() => setStickersOpen((s) => !s)}>
              <SmileIcon size={22} color={stickersOpen ? colors.accent : colors.inkFaint} strokeWidth={1.7} />
            </Pressable>
          </View>
          {draft.trim() ? (
            <Pressable style={styles.sendButton} onPress={() => sendText(draft)} disabled={isSending}>
              <ArrowRightIcon size={19} color="#fff" strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
    </ScreenGradient>
  );
}

const shadowSm = {
  shadowColor: "#171412",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 56,
    paddingHorizontal: 12,
    paddingBottom: 14,
    backgroundColor: colors.canvas,
    ...shadowSm,
    shadowOpacity: 0.05,
    zIndex: 1,
  },
  headerIconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerAvatarRing: { borderWidth: 2, borderColor: colors.accentTint, borderRadius: 16, padding: 2 },
  headerName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  headerStatus: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.success, marginTop: 2 },
  headerStatusTyping: { color: colors.accent, fontFamily: fonts.bodyBold },
  messageArea: { flex: 1, backgroundColor: colors.surface },
  messageList: { padding: 18, paddingTop: 12, gap: 3 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: colors.ink, marginTop: 8 },
  emptySubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, textAlign: "center" },
  error: { color: colors.cheer, textAlign: "center", paddingVertical: 6, backgroundColor: colors.surface },
  quickReplies: { paddingHorizontal: 18, paddingVertical: 12, gap: 8, backgroundColor: colors.surface },
  quickReplyChip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  quickReplyText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.ink },
  stickerChip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stickerChipText: { fontSize: 22 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: 12, paddingBottom: 28, paddingTop: 8, backgroundColor: colors.canvas },
  composerSideButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  composerPill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingLeft: 18,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  composerTextInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 12 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", ...shadowSm, shadowColor: colors.accent, shadowOpacity: 0.3 },
});
