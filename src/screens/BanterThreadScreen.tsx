import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import dayjs from "@/lib/dayjs";
import { chat, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { DateSeparator } from "@/components/chat/DateSeparator";
import { ImageViewerModal } from "@/components/chat/ImageViewerModal";
import { ExpressionTray, type TrayTab } from "@/components/chat/ExpressionTray";
import { BackIcon, CallVideoIcon, FaceIcon, KeyboardIcon, PhoneIcon, PhotoIcon, PlaneIcon, StickerIcon } from "@/components/chat/ChatIcons";
import { DEFAULT_RECENTS, gifBody, graphemes, stickerBody, type Gif, type StickerItem } from "@/components/chat/expressions";
import { getMessages, getPresence, markSeen, openMessage, sendMessage, sendTyping, reactToMessage, unreactToMessage, type Presence } from "@/api/banters";
import { uploadLocalAsset } from "@/api/media";
import { ensureBanterKey } from "@/crypto/banterKeys";
import { useSession } from "@/session/SessionContext";
import { realtimeSocket } from "@/realtime/socket";
import type { EncryptedMessage, Message } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
const TYPING_SEND_INTERVAL_MS = 2000;
const TYPING_EXPIRE_MS = 3000;
const SEPARATOR_GAP_MS = 30 * 60 * 1000;

type Row =
  | { kind: "date"; key: string; createdAt: string }
  | { kind: "message"; key: string; item: ChatMessage; joinsPrev: boolean; joinsNext: boolean }
  | { kind: "seen"; key: string; seenAt: string };

type Props = NativeStackScreenProps<RootStackParamList, "BanterThread">;

// The list is inverted (newest at the bottom, older pages load as you scroll
// up), so each cell is a sibling whose paint order is newest-first. The cell
// whose quick-reaction bar is open is lifted so the bar overlaps older rows.
const RaisedCellContext = createContext<string | null>(null);

function ChatCell({ item, style, children, ...rest }: { item: Row; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const raised = useContext(RaisedCellContext);
  return (
    <View {...rest} style={[style, item.key === raised && { zIndex: 10, elevation: 10 }]}>
      {children}
    </View>
  );
}

function startsNewBlock(prev: ChatMessage | undefined, item: ChatMessage) {
  return !prev || !dayjs(prev.createdAt).isSame(dayjs(item.createdAt), "day") || dayjs(item.createdAt).diff(dayjs(prev.createdAt)) > SEPARATOR_GAP_MS;
}

function seenText(seenAt: string) {
  const mins = dayjs().diff(dayjs(seenAt), "minute");
  if (mins < 1) return "Seen just now";
  if (mins < 60) return `Seen ${mins}m ago`;
  return `Seen ${dayjs(seenAt).fromNow()}`;
}

export function BanterThreadScreen({ route, navigation }: Props) {
  const { banterId, handle } = route.params;
  const { user } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trayTab, setTrayTab] = useState<TrayTab | null>(null);
  const [recents, setRecents] = useState(DEFAULT_RECENTS);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [reactTarget, setReactTarget] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<"loading" | "ready" | "waiting">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const loadingOlderRef = useRef(false);
  const listRef = useRef<FlatList<Row>>(null);
  const lastTypingSentAt = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateNext = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
  }, []);

  // Inverted list: offset 0 is the newest message.
  const scrollToEnd = useCallback(() => requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true })), []);

  // Unlock the banter key first (messages decrypt with it), then the latest page.
  const load = useCallback(async () => {
    setError(null);
    try {
      const key = await ensureBanterKey(banterId).catch(() => null);
      setKeyStatus(key ? "ready" : "waiting");
      const page = await getMessages(banterId);
      setMessages(page.items);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this banter");
    } finally {
      setIsLoading(false);
    }
  }, [banterId]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    try {
      const page = await getMessages(banterId, nextCursor);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...page.items.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load older messages");
    } finally {
      loadingOlderRef.current = false;
    }
  }, [banterId, hasMore, nextCursor]);

  useEffect(() => {
    load();
  }, [load]);

  // A message counts as seen only while this thread is the focused screen and
  // the app is in the foreground (on web: the tab is visible).
  const markSeenIfWatching = useCallback(() => {
    if (navigation.isFocused() && AppState.currentState === "active") markSeen(banterId).catch(() => {});
  }, [banterId, navigation]);

  // Catch up on anything that arrived while the app was backgrounded or the
  // user was on another screen (e.g. the peer's profile).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => state === "active" && markSeenIfWatching());
    const offFocus = navigation.addListener("focus", markSeenIfWatching);
    return () => {
      sub.remove();
      offFocus();
    };
  }, [markSeenIfWatching, navigation]);

  // Live incoming messages, typing, read receipts, reactions, and key hand-offs
  // for this thread. (The socket itself lives for the whole session — see SessionContext.)
  useEffect(() => {
    const offKeyShared = realtimeSocket.on("banter.keyShared", (payload) => {
      if ((payload as { banterId: string }).banterId === banterId) load();
    });
    const offMessage = realtimeSocket.on("message.new", async (payload) => {
      const raw = payload as EncryptedMessage;
      if (raw.banterId !== banterId) return;
      let message = openMessage(raw);
      // First message after a peer established (or shared) the key — pick it up.
      if (message.undecryptable && (await ensureBanterKey(banterId).catch(() => null))) {
        setKeyStatus("ready");
        message = openMessage(raw);
      }
      setOtherTyping(false);
      animateNext();
      // The server only relays to the *other* participants, so this is never our own echo.
      setTotal((t) => t + 1);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      markSeenIfWatching();
      scrollToEnd();
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
      setMessages((prev) => prev.map((m) => (m.senderId === user?.id && !m.seenAt && !m.pending ? { ...m, seenAt } : m)));
    });
    const offReaction = realtimeSocket.on("message.reaction", (payload) => {
      const { messageId, reactions } = payload as { messageId: string; reactions: Message["reactions"] };
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });
    // Online / last seen: fetch now (which also subscribes us), then follow live
    // `presence` events; refetch after a reconnect in case we missed a change.
    const syncPresence = () =>
      getPresence(banterId)
        .then((res) => setPresence(res.items[0] ?? null))
        .catch(() => {});
    syncPresence();
    const offOpen = realtimeSocket.on("socket.open", syncPresence);
    const offPresence = realtimeSocket.on("presence", (payload) => {
      const p = payload as Presence;
      setPresence((current) => (current && current.userId === p.userId ? p : current));
      if (!p.online) setOtherTyping(false);
    });
    return () => {
      offOpen();
      offPresence();
      offKeyShared();
      offMessage();
      offTyping();
      offSeen();
      offReaction();
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    };
  }, [banterId, user?.id, animateNext, scrollToEnd, load, markSeenIfWatching]);

  const peer = useMemo(() => {
    const sender = messages.find((m) => m.senderId !== user?.id && m.sender)?.sender;
    return { handle, displayName: sender?.displayName ?? handle, avatarUrl: sender?.avatarUrl ?? null };
  }, [messages, user?.id, handle]);

  // Re-render every 30s so "Active 3m ago" keeps counting.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const isOnline = otherTyping || !!presence?.online;
  const statusText = otherTyping
    ? "typing…"
    : presence?.online
      ? "Active now"
      : presence?.lastSeenAt
        ? `Active ${dayjs(presence.lastSeenAt).fromNow()}`
        : `@${handle}`;

  function onDraftChange(text: string) {
    setDraft(text);
    const now = Date.now();
    if (text.trim() && now - lastTypingSentAt.current > TYPING_SEND_INTERVAL_MS) {
      lastTypingSentAt.current = now;
      sendTyping(banterId).catch(() => {});
    }
  }

  // Optimistic: the bubble shows immediately with a clock tick, then swaps for the server copy.
  async function send(input: { body?: string; imageUrl?: string; kind: "text" | "image" | "sticker" }) {
    if (!user || keyStatus !== "ready") return;
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const local: ChatMessage = {
      id: localId,
      banterId,
      senderId: user.id,
      kind: input.kind,
      body: input.body ?? null,
      imageUrl: input.imageUrl ?? null,
      sharedDropId: null,
      createdAt: new Date().toISOString(),
      seenAt: null,
      reactions: [],
      pending: true,
    };
    setReactFor(null);
    animateNext();
    setMessages((prev) => [...prev, local]);
    scrollToEnd();
    try {
      const message = await sendMessage(banterId, input);
      setTotal((t) => t + 1);
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev.filter((m) => m.id !== localId) : prev.map((m) => (m.id === localId ? message : m))
      );
    } catch (err) {
      animateNext();
      setMessages((prev) => prev.filter((m) => m.id !== localId));
      setError(err instanceof Error ? err.message : "Message didn't send");
    }
  }

  function sendText() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    send({ body, kind: "text" });
  }

  function sendGif(gif: Gif) {
    send({ body: gifBody(gif), kind: "sticker" });
  }

  function sendSticker(item: StickerItem) {
    send({ body: stickerBody(item), kind: "sticker" });
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

  function openTray(tab: TrayTab) {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.create(280, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setReactFor(null);
    setReactTarget(null);
    setTrayTab((current) => (current === tab ? null : tab));
    scrollToEnd();
  }

  function closeTray() {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setTrayTab(null);
    setReactTarget(null);
  }

  function pickEmoji(emoji: string) {
    setRecents((prev) => [emoji, ...prev.filter((x) => x !== emoji)].slice(0, 24));
    if (reactTarget) {
      const current = messages.find((m) => m.id === reactTarget)?.reactions.find((r) => r.userId === user?.id);
      if (current?.emoji === emoji) onUnreact(reactTarget);
      else onReact(reactTarget, emoji);
      closeTray();
      return;
    }
    setDraft((d) => d + emoji);
  }

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    messages.forEach((item, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const newBlock = startsNewBlock(prev, item);
      if (newBlock) out.push({ kind: "date", key: `date-${item.id}`, createdAt: item.createdAt });
      const joinsPrev = !newBlock && prev.senderId === item.senderId;
      const joinsNext = !!next && !startsNewBlock(item, next) && next.senderId === item.senderId;
      out.push({ kind: "message", key: item.id, item, joinsPrev, joinsNext });
    });
    const last = messages[messages.length - 1];
    if (last && last.senderId === user?.id && last.seenAt) out.push({ kind: "seen", key: "seen", seenAt: last.seenAt });
    // Newest first for the inverted list.
    return out.reverse();
  }, [messages, user?.id]);

  const hasText = draft.trim().length > 0;
  const trayOpen = trayTab !== null;

  const intro = (
    <View style={styles.intro}>
      <Avatar handle={peer.handle} displayName={peer.displayName} avatarUrl={peer.avatarUrl} size={84} radius={42} />
      <Text style={styles.introName}>{peer.displayName}</Text>
      <Text style={styles.introMeta}>@{handle} · Rebanter</Text>
      {messages.length === 0 ? <Text style={styles.introMeta}>Say hi — this is the start of your banter.</Text> : null}
      <Text style={styles.introLock}>
        🔒 End-to-end encrypted{total > 0 ? ` · ${total} message${total === 1 ? "" : "s"}` : ""}
      </Text>
      <Pressable style={styles.introButton} onPress={() => navigation.navigate("UserProfile", { handle })}>
        <Text style={styles.introButtonText}>View profile</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={6}>
            <BackIcon />
          </Pressable>
          <View>
            <Avatar handle={peer.handle} displayName={peer.displayName} avatarUrl={peer.avatarUrl} size={40} radius={20} />
            {isOnline ? <View style={styles.onlineDot} /> : null}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {peer.displayName}
            </Text>
            <Text style={[styles.headerStatus, otherTyping && { color: chat.bubbleMine }]} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
          <Pressable style={({ pressed }) => [styles.headerIconButton, pressed && { backgroundColor: chat.hairline }]}>
            <PhoneIcon />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.headerIconButton, pressed && { backgroundColor: chat.hairline }]}>
            <CallVideoIcon />
          </Pressable>
        </View>

        <View style={styles.messageArea}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={chat.bubbleMine} />
          ) : (
            <RaisedCellContext.Provider value={reactFor}>
            <FlatList
              ref={listRef}
              inverted
              data={rows}
              keyExtractor={(row) => row.key}
              extraData={reactFor}
              CellRendererComponent={ChatCell}
              contentContainerStyle={styles.messageList}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => setReactFor(null)}
              onEndReached={loadOlder}
              onEndReachedThreshold={0.4}
              // Inverted: the header sits at the bottom (typing), the footer at the top.
              ListHeaderComponent={otherTyping ? <TypingIndicator peer={peer} /> : null}
              ListFooterComponent={hasMore ? <ActivityIndicator style={styles.olderSpinner} color={chat.inkMuted} /> : intro}
              renderItem={({ item: row }) =>
                row.kind === "date" ? (
                  <DateSeparator createdAt={row.createdAt} />
                ) : row.kind === "seen" ? (
                  <View style={styles.seenRow}>
                    <View style={styles.seenDot} />
                    <Text style={styles.seenText}>{seenText(row.seenAt)}</Text>
                  </View>
                ) : (
                  <View style={{ marginTop: row.joinsPrev ? 2 : 10 }}>
                    <MessageBubble
                      message={row.item}
                      mine={row.item.senderId === user?.id}
                      peer={peer}
                      joinsPrev={row.joinsPrev}
                      joinsNext={row.joinsNext}
                      currentUserId={user?.id}
                      reactOpen={reactFor === row.item.id}
                      onToggleReact={setReactFor}
                      onReact={onReact}
                      onUnreact={onUnreact}
                      onMoreReactions={(id) => {
                        Keyboard.dismiss();
                        LayoutAnimation.configureNext(LayoutAnimation.create(280, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
                        setReactTarget(id);
                        setTrayTab("emoji");
                      }}
                      onImagePress={setViewerUri}
                    />
                  </View>
                )
              }
            />
            </RaisedCellContext.Provider>
          )}
        </View>

        {keyStatus === "waiting" ? (
          <Text style={styles.keyBanner}>
            🔒 Getting this chat's encryption key from {peer.displayName}'s device — it arrives automatically as soon as they're online.
          </Text>
        ) : null}

        {error ? (
          <Pressable onPress={() => setError(null)}>
            <Text style={styles.error}>{error}</Text>
          </Pressable>
        ) : null}

        {keyStatus !== "waiting" ? (
        <View style={[styles.composerRow, trayOpen && styles.composerRowTrayOpen]}>
          <View style={styles.composerPill}>
            <Pressable
              style={[styles.pillButton, styles.emojiToggle, trayOpen && { backgroundColor: chat.bubbleMine }]}
              onPress={() => (trayOpen ? closeTray() : openTray("emoji"))}
            >
              {trayOpen ? <KeyboardIcon color={chat.onMine} /> : <FaceIcon />}
            </Pressable>
            <TextInput
              style={styles.composerTextInput}
              placeholder="Message…"
              placeholderTextColor="#8C8A94"
              value={draft}
              onChangeText={onDraftChange}
              onFocus={() => trayOpen && closeTray()}
              multiline
            />
            {!hasText ? (
              <View style={styles.pillActions}>
                <Pressable style={styles.pillButton} onPress={() => openTray("gif")}>
                  <Text style={styles.gifGlyph}>GIF</Text>
                </Pressable>
                <Pressable style={styles.pillButton} onPress={() => openTray("stickers")}>
                  <StickerIcon />
                </Pressable>
                <Pressable style={styles.pillButton} onPress={pickAndSendImage} disabled={isUploadingImage}>
                  {isUploadingImage ? <ActivityIndicator size="small" color={chat.ink} /> : <PhotoIcon />}
                </Pressable>
              </View>
            ) : null}
          </View>
          {hasText ? (
            <Pressable style={styles.sendButton} onPress={sendText} accessibilityRole="button" accessibilityLabel="Send message">
              <PlaneIcon />
            </Pressable>
          ) : null}
        </View>
        ) : null}

        {trayTab && keyStatus !== "waiting" ? (
          <View style={styles.trayWrap}>
            <ExpressionTray
              tab={trayTab}
              onTabChange={setTrayTab}
              recents={recents}
              reacting={!!reactTarget}
              onCancelReact={closeTray}
              onPickEmoji={pickEmoji}
              onSendGif={sendGif}
              onSendSticker={sendSticker}
              onBackspace={() => setDraft((d) => graphemes(d).slice(0, -1).join(""))}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: chat.bg },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    paddingLeft: 6,
    paddingRight: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: chat.hairline,
  },
  backButton: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  onlineDot: { position: "absolute", right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: chat.bubbleMine, borderWidth: 2.5, borderColor: chat.bg },
  headerText: { flex: 1, minWidth: 0, gap: 1 },
  headerName: { fontFamily: fonts.displaySemibold, fontSize: 16, letterSpacing: -0.15, color: chat.ink },
  headerStatus: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: chat.inkMuted },
  headerIconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  messageArea: { flex: 1 },
  messageList: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 },
  intro: { alignItems: "center", gap: 4, paddingTop: 18, paddingBottom: 10 },
  introName: { fontFamily: fonts.displaySemibold, fontSize: 19, color: chat.ink, marginTop: 8 },
  introMeta: { fontFamily: fonts.body, fontSize: 13, color: chat.inkMuted, textAlign: "center" },
  introLock: { fontFamily: fonts.bodyMedium, fontSize: 12, color: chat.inkMuted, marginTop: 2 },
  olderSpinner: { paddingVertical: 18 },
  keyBanner: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: chat.inkSoft,
    textAlign: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: chat.hairline,
  },
  introButton: { marginTop: 10, height: 32, paddingHorizontal: 16, borderRadius: 10, backgroundColor: chat.bubbleTheirs, justifyContent: "center" },
  introButtonText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: chat.ink },
  seenRow: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5, paddingRight: 2 },
  seenDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: chat.peer },
  seenText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: chat.inkMuted },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: chat.danger, textAlign: "center", paddingVertical: 6 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 28 },
  composerRowTrayOpen: { paddingBottom: 8 },
  composerPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    maxHeight: 130,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 5,
    backgroundColor: chat.field,
    borderWidth: 1,
    borderColor: chat.fieldBorder,
    borderRadius: 24,
  },
  pillButton: { width: 36, height: 38, alignItems: "center", justifyContent: "center" },
  emojiToggle: { width: 38, borderRadius: 19 },
  pillActions: { flexDirection: "row" },
  gifGlyph: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 11,
    letterSpacing: 0.4,
    color: chat.ink,
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderWidth: 1.8,
    borderColor: chat.ink,
    borderRadius: 6,
  },
  composerTextInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
    fontSize: 15,
    color: chat.ink,
    paddingHorizontal: 4,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
  },
  sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: chat.bubbleMine, alignItems: "center", justifyContent: "center" },
  trayWrap: { paddingBottom: 24, backgroundColor: chat.tray },
});
