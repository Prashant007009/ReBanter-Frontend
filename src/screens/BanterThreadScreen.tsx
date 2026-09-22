import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ScreenGradient } from "@/components/ScreenGradient";
import { ChevronLeftIcon, VideoIcon, MoreHorizontalIcon, CameraIcon, SmileIcon, ArrowRightIcon } from "@/assets/icons";
import { getMessages, sendMessage, sendTyping } from "@/api/banters";
import { uploadLocalAsset } from "@/api/media";
import { useSession } from "@/session/SessionContext";
import { realtimeSocket } from "@/realtime/socket";
import type { Message } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

const QUICK_REPLIES = ["on my way", "send the raw", "ha, fair"];
const STICKERS = ["😂", "❤️", "😍", "🔥", "👏", "😢", "😮", "🎉", "🙌", "😎", "🤔", "👍", "💯", "😭", "🥳", "🙏"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
const TYPING_SEND_INTERVAL_MS = 2000;
const TYPING_EXPIRE_MS = 3000;

interface GroupedMessage {
  item: Message;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

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
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<GroupedMessage>>(null);
  const lastTypingSentAt = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Live incoming messages + typing indicator for this thread.
  useEffect(() => {
    realtimeSocket.connect();
    const offMessage = realtimeSocket.on("message.new", (payload) => {
      const message = payload as Message;
      if (message.banterId !== banterId) return;
      setOtherTyping(false);
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
    return () => {
      offMessage();
      offTyping();
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      realtimeSocket.disconnect();
    };
  }, [banterId]);

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

  const groups = useMemo(() => {
    return messages.map((item, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const isFirstInGroup = !prev || prev.senderId !== item.senderId;
      const isLastInGroup = !next || next.senderId !== item.senderId;
      return { item, isFirstInGroup, isLastInGroup };
    });
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

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
        ) : (
          <FlatList
            ref={listRef}
            data={groups}
            keyExtractor={({ item }) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={
              otherTyping ? (
                <View style={{ alignItems: "flex-start" }}>
                  <View style={[styles.bubble, styles.bubbleTheirs, styles.typingBubble]}>
                    <Text style={styles.typingDots}>•••</Text>
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item: { item, isFirstInGroup, isLastInGroup } }) => {
              const mine = item.senderId === user?.id;
              const cornerStyle = mine
                ? { borderBottomRightRadius: isLastInGroup ? 6 : 20 }
                : { borderBottomLeftRadius: isLastInGroup ? 6 : 20 };
              return (
                <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginTop: isFirstInGroup ? 12 : 2 }}>
                  {item.kind === "sticker" ? (
                    <Text style={styles.stickerText}>{item.body}</Text>
                  ) : item.kind === "image" && item.imageUrl ? (
                    <View style={[styles.imageBubble, cornerStyle]}>
                      <Image source={{ uri: item.imageUrl }} style={styles.imageBubbleImage} resizeMode="cover" />
                    </View>
                  ) : (
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, cornerStyle]}>
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                    </View>
                  )}
                  {isLastInGroup ? <Text style={styles.bubbleTime}>{dayjs(item.createdAt).format("H:mm")}</Text> : null}
                </View>
              );
            }}
          />
        )}

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
  messageList: { padding: 18, paddingTop: 12, gap: 2 },
  bubble: { maxWidth: "72%", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceRaised, ...shadowSm },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.accent, ...shadowSm, shadowColor: colors.accent, shadowOpacity: 0.25 },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  bubbleTextMine: { color: "#fff" },
  bubbleTime: { fontFamily: fonts.body, fontSize: 10, color: colors.inkFaint, marginTop: 4, marginHorizontal: 4 },
  stickerText: { fontSize: 48, lineHeight: 56, marginVertical: 2 },
  imageBubble: { maxWidth: 220, borderRadius: 22, overflow: "hidden", ...shadowSm },
  imageBubbleImage: { width: 220, height: 220, backgroundColor: colors.hairline },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 18 },
  typingDots: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.inkMuted, letterSpacing: 2 },
  error: { color: colors.cheer, textAlign: "center", paddingBottom: 6 },
  quickReplies: { paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  quickReplyChip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  quickReplyText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.ink },
  stickerChip: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stickerChipText: { fontSize: 22 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: 12, paddingBottom: 28, paddingTop: 6 },
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
