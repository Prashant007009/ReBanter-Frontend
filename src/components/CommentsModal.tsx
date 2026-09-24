import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import dayjs from "@/lib/dayjs";
import { fonts, stream } from "@/theme/colors";
import { Avatar } from "./Avatar";
import { HeartIcon, ReplyIcon } from "@/assets/icons";
import { getReplies, replyToDrop, likeReply, unlikeReply } from "@/api/drops";
import { search } from "@/api/search";
import { useSession } from "@/session/SessionContext";
import type { Reply, UserSummary } from "@/api/types";

const QUICK_EMOJI = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];
const MENTION_FRAGMENT_RE = /(?:^|\s)@([a-z0-9._]*)$/i;

function trailingMentionFragment(text: string): string | null {
  const m = text.match(MENTION_FRAGMENT_RE);
  return m ? m[1] : null;
}

/** Splits a comment body into plain/mention segments so @handles render highlighted. */
function renderBody(body: string, style: object, mentionStyle: object) {
  const parts = body.split(/(@[a-z0-9._]+)/gi);
  return parts.map((part, i) =>
    /^@[a-z0-9._]+$/i.test(part) ? (
      <Text key={i} style={mentionStyle}>
        {part}
      </Text>
    ) : (
      <Text key={i} style={style}>
        {part}
      </Text>
    )
  );
}

function updateCommentTree(comments: Reply[], id: string, updater: (c: Reply) => Reply): Reply[] {
  return comments.map((c) => {
    if (c.id === id) return updater(c);
    if (c.replies?.length) return { ...c, replies: updateCommentTree(c.replies, id, updater) };
    return c;
  });
}

function CommentRow({
  comment,
  nested,
  onToggleLike,
  onReply,
}: {
  comment: Reply;
  nested: boolean;
  onToggleLike: (c: Reply) => void;
  onReply: (c: Reply) => void;
}) {
  return (
    <View style={[styles.row, nested && styles.rowNested]}>
      <Avatar handle={comment.author.handle} displayName={comment.author.displayName} avatarUrl={comment.author.avatarUrl} size={nested ? 30 : 38} radius={nested ? 10 : 13} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowHandle}>@{comment.author.handle}</Text>
          <Text style={styles.rowTime}>{dayjs(comment.createdAt).fromNow()}</Text>
        </View>
        <Text style={styles.rowBody}>{renderBody(comment.body, styles.rowBody, styles.mention)}</Text>
        <View style={styles.rowActions}>
          <Pressable style={styles.rowAction} onPress={() => onToggleLike(comment)} hitSlop={6}>
            <HeartIcon size={15} color={comment.likedByMe ? stream.red : stream.inkMuted} filled={comment.likedByMe} strokeWidth={1.8} />
            {comment.likeCount > 0 ? <Text style={styles.rowActionText}>{comment.likeCount}</Text> : null}
          </Pressable>
          <Pressable style={styles.rowAction} onPress={() => onReply(comment)} hitSlop={6}>
            <ReplyIcon size={14} color={stream.inkMuted} strokeWidth={1.8} />
            <Text style={styles.rowActionText}>Reply</Text>
          </Pressable>
        </View>

        {comment.replies && comment.replies.length > 0 ? (
          <View style={styles.repliesBlock}>
            {comment.replies.map((child) => (
              <CommentRow key={child.id} comment={child} nested onToggleLike={onToggleLike} onReply={onReply} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function CommentsModal({
  visible,
  dropId,
  onClose,
  onCommented,
}: {
  visible: boolean;
  dropId: string;
  onClose: () => void;
  onCommented: () => void;
}) {
  const { user } = useSession();
  const [comments, setComments] = useState<Reply[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; handle: string } | null>(null);
  const [mentionResults, setMentionResults] = useState<UserSummary[]>([]);
  const listRef = useRef<FlatList<Reply>>(null);
  const scrollOnLoadRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getReplies(dropId);
      setComments(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load comments");
    } finally {
      setIsLoading(false);
      if (scrollOnLoadRef.current) {
        scrollOnLoadRef.current = false;
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      }
    }
  }, [dropId]);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    setReplyingTo(null);
    setDraft("");
    load();
  }, [visible, load]);

  // Debounced @mention autocomplete — only while the draft ends in "@fragment".
  useEffect(() => {
    const fragment = trailingMentionFragment(draft);
    if (fragment === null || fragment.length === 0) {
      setMentionResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await search(fragment);
        setMentionResults(res.users.slice(0, 5));
      } catch {
        setMentionResults([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [draft]);

  function onPickMention(u: UserSummary) {
    setDraft((prev) => prev.replace(MENTION_FRAGMENT_RE, (match) => match[0] + `${u.handle} `));
    setMentionResults([]);
  }

  function onStartReply(comment: Reply) {
    const topLevelId = comment.parentId ?? comment.id;
    setReplyingTo({ id: topLevelId, handle: comment.author.handle });
    setDraft(`@${comment.author.handle} `);
    setMentionResults([]);
  }

  async function onToggleLike(comment: Reply) {
    const wasLiked = comment.likedByMe;
    setComments((prev) => updateCommentTree(prev, comment.id, (c) => ({ ...c, likedByMe: !wasLiked, likeCount: c.likeCount + (wasLiked ? -1 : 1) })));
    try {
      const res = wasLiked ? await unlikeReply(comment.id) : await likeReply(comment.id);
      setComments((prev) => updateCommentTree(prev, comment.id, (c) => ({ ...c, likedByMe: res.likedByMe, likeCount: res.likeCount })));
    } catch {
      setComments((prev) => updateCommentTree(prev, comment.id, (c) => ({ ...c, likedByMe: wasLiked, likeCount: c.likeCount + (wasLiked ? 1 : -1) })));
    }
  }

  async function onSend() {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setError(null);
    const parentId = replyingTo?.id;
    try {
      await replyToDrop(dropId, body, parentId);
      setDraft("");
      setReplyingTo(null);
      onCommented();
      scrollOnLoadRef.current = true;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that comment");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Banter · {total}</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={stream.inkMuted} />
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(c) => c.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.emptySubtitle}>Be the first to say something.</Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => <CommentRow comment={item} nested={false} onToggleLike={onToggleLike} onReply={onStartReply} />}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {mentionResults.length > 0 ? (
          <View style={styles.mentionCard}>
            {mentionResults.map((u) => (
              <Pressable key={u.id} style={styles.mentionRow} onPress={() => onPickMention(u)}>
                <Avatar handle={u.handle} displayName={u.displayName} avatarUrl={u.avatarUrl} size={26} radius={9} />
                <Text style={styles.mentionHandle}>@{u.handle}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {replyingTo ? (
          <View style={styles.replyingChipRow}>
            <Text style={styles.replyingChipText}>Replying to @{replyingTo.handle}</Text>
            <Pressable
              onPress={() => {
                setReplyingTo(null);
                setDraft("");
              }}
              hitSlop={8}
            >
              <Text style={styles.replyingChipCancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.quickRow}>
          {QUICK_EMOJI.map((e) => (
            <Pressable key={e} style={({ pressed }) => [styles.quickButton, pressed && { backgroundColor: stream.raised }]} onPress={() => setDraft((d) => d + e)}>
              <Text style={styles.quickEmoji}>{e}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.composerRow}>
          {user ? <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={34} radius={12} /> : null}
          <View style={styles.composerPill}>
            <TextInput
              style={styles.composerInput}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={onSend}
              placeholder={replyingTo ? `Reply to ${replyingTo.handle}…` : "Add some banter…"}
              placeholderTextColor="#8C8A94"
              returnKeyType="send"
            />
            <Pressable
              style={[styles.sendButton, { backgroundColor: draft.trim() ? stream.lime : stream.raisedHover }]}
              onPress={onSend}
              disabled={!draft.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={stream.onLime} />
              ) : (
                <Text style={[styles.sendText, { color: draft.trim() ? stream.onLime : stream.inkFaint }]}>Post</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { height: "78%", backgroundColor: stream.sheet, borderTopWidth: 1, borderColor: stream.sheetBorder, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  handle: { width: 38, height: 4, borderRadius: 4, backgroundColor: "#3A3A42", alignSelf: "center", marginTop: 9 },
  header: { alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1F1F24" },
  title: { fontFamily: fonts.display, fontSize: 16, color: stream.ink },
  list: { paddingHorizontal: 16, paddingVertical: 14, flexGrow: 1 },
  separator: { height: 16 },
  row: { flexDirection: "row", gap: 10 },
  rowNested: { marginTop: 14 },
  rowTopLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowHandle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.ink },
  rowTime: { fontFamily: fonts.body, fontSize: 13, color: stream.inkMuted },
  rowBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19.6, color: stream.ink, marginTop: 3 },
  mention: { fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 19.6, color: stream.lime },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 6 },
  rowAction: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowActionText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.inkMuted },
  repliesBlock: { marginTop: 4, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: stream.raised },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 15, color: stream.ink },
  emptySubtitle: { fontFamily: fonts.body, fontSize: 13, color: stream.inkMuted, marginTop: 5 },
  error: { color: stream.redSoft, textAlign: "center", fontFamily: fonts.body, fontSize: 12, paddingHorizontal: 20, paddingBottom: 6 },
  mentionCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: stream.raised, borderWidth: 1, borderColor: stream.raisedBorder, borderRadius: 16, overflow: "hidden" },
  mentionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  mentionHandle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.ink },
  replyingChipRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginBottom: 6, backgroundColor: stream.raised, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  replyingChipText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: stream.inkSoft },
  replyingChipCancel: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.lime },
  quickRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, borderTopWidth: 1, borderTopColor: "#1F1F24" },
  quickButton: { flex: 1, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickEmoji: { fontSize: 22 },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 4, paddingBottom: Platform.OS === "ios" ? 28 : 18 },
  composerPill: { flex: 1, flexDirection: "row", alignItems: "center", height: 44, paddingLeft: 16, paddingRight: 4, backgroundColor: stream.raised, borderWidth: 1, borderColor: stream.raisedBorder, borderRadius: 22 },
  composerInput: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14.5, color: stream.ink, paddingVertical: 0 },
  sendButton: { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sendText: { fontFamily: fonts.bodySemibold, fontSize: 13.5 },
});
