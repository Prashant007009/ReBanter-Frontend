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
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "./Avatar";
import { ArrowRightIcon, HeartIcon, ReplyIcon } from "@/assets/icons";
import { getReplies, replyToDrop, likeReply, unlikeReply } from "@/api/drops";
import { search } from "@/api/search";
import { useSession } from "@/session/SessionContext";
import type { Reply, UserSummary } from "@/api/types";

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
            <HeartIcon size={15} color={comment.likedByMe ? colors.cheer : colors.inkFaint} filled={comment.likedByMe} strokeWidth={1.8} />
            {comment.likeCount > 0 ? <Text style={styles.rowActionText}>{comment.likeCount}</Text> : null}
          </Pressable>
          <Pressable style={styles.rowAction} onPress={() => onReply(comment)} hitSlop={6}>
            <ReplyIcon size={14} color={colors.inkFaint} strokeWidth={1.8} />
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
          <Text style={styles.title}>Comments{total > 0 ? ` (${total})` : ""}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
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

        <View style={styles.composerRow}>
          {user ? <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={32} radius={11} /> : null}
          <TextInput
            style={styles.composerInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment…"
            placeholderTextColor={colors.inkFaint}
            multiline
          />
          <Pressable style={styles.sendButton} onPress={onSend} disabled={!draft.trim() || isSending}>
            {isSending ? <ActivityIndicator size="small" color={colors.surfaceRaised} /> : <ArrowRightIcon size={17} color={colors.surfaceRaised} strokeWidth={2.2} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(23,20,18,0.4)" },
  sheet: { height: "82%", backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairlineStrong, alignSelf: "center", marginTop: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  title: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.ink },
  close: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.accent },
  list: { paddingHorizontal: 20, paddingVertical: 16, flexGrow: 1 },
  separator: { height: 18 },
  row: { flexDirection: "row", gap: 12 },
  rowNested: { marginTop: 14 },
  rowTopLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowHandle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  rowTime: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint },
  rowBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 4 },
  mention: { fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 20, color: colors.accent },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 8 },
  rowAction: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowActionText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkFaint },
  repliesBlock: {
    marginTop: 4,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.hairlineSoft,
  },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 15, color: colors.ink },
  emptySubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: 5 },
  error: { color: colors.cheer, textAlign: "center", fontFamily: fonts.body, fontSize: 12, paddingHorizontal: 20, paddingBottom: 6 },
  mentionCard: {
    marginHorizontal: 18,
    marginBottom: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 16,
    overflow: "hidden",
  },
  mentionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  mentionHandle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ink },
  replyingChipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 18,
    marginBottom: 8,
    backgroundColor: colors.accentTint,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  replyingChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accent },
  replyingChipCancel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  sendButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});
