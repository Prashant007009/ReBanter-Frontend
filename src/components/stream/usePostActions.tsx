import { createContext, useCallback, useContext, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { CommentsModal } from "@/components/CommentsModal";
import { hideDrop, reactToDrop, setStance, unreactToDrop, votePoll } from "@/api/drops";
import { acceptCrewRequest, sendCrewRequest } from "@/api/crew";
import { useSession } from "@/session/SessionContext";
import type { StreamDrop } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";
import type { PostActions } from "./StreamPost";
import { ShareSheet } from "./ShareSheet";
import { dropLink } from "./format";
import { useToast } from "./Toast";

/**
 * Everything a list of Stream cards needs besides the cards: optimistic
 * like/save/vote/stance/follow/hide handlers, the "…" menu state, and the
 * comments + share sheets. Shared by Stream, hashtag pages and single drops.
 */
export function usePostActions(
  setDrops: Dispatch<SetStateAction<StreamDrop[]>>,
  options: { onOpenMoment?: (authorId: string) => void } = {}
) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<StreamDrop | null>(null);
  const [shareFor, setShareFor] = useState<StreamDrop | null>(null);
  const [followedNow, setFollowedNow] = useState<Record<string, boolean>>({});

  const patch = useCallback(
    (id: string, fn: (d: StreamDrop) => StreamDrop) => setDrops((prev) => prev.map((d) => (d.id === id ? fn(d) : d))),
    [setDrops]
  );
  const replace = useCallback((updated: StreamDrop) => patch(updated.id, () => updated), [patch]);

  // Latest handlers live in a ref so the memoised `actions` object stays stable.
  const impl = useRef<PostActions>(null as unknown as PostActions);
  impl.current = {
    onLike(drop, force) {
      if (force && drop.likedByMe) return;
      const liked = !drop.likedByMe;
      patch(drop.id, (d) => ({ ...d, likedByMe: liked, counts: { ...d.counts, likes: d.counts.likes + (liked ? 1 : -1) } }));
      (liked ? reactToDrop(drop.id, "cheer") : unreactToDrop(drop.id, "cheer")).catch(() =>
        patch(drop.id, (d) => ({ ...d, likedByMe: !liked, counts: { ...d.counts, likes: d.counts.likes + (liked ? -1 : 1) } }))
      );
    },
    onSave(drop) {
      const saved = !drop.savedByMe;
      setMenuFor(null);
      patch(drop.id, (d) => ({ ...d, savedByMe: saved }));
      toast(saved ? "Saved to your collection" : "Removed from saved");
      (saved ? reactToDrop(drop.id, "save") : unreactToDrop(drop.id, "save")).catch(() => patch(drop.id, (d) => ({ ...d, savedByMe: !saved })));
    },
    onComments(drop) {
      setMenuFor(null);
      setCommentsFor(drop);
    },
    onShare(drop) {
      setMenuFor(null);
      setShareFor(drop);
    },
    async onFollow(drop) {
      const accept = drop.relationship === "incoming";
      setFollowedNow((f) => ({ ...f, [drop.author.id]: true }));
      const next = accept ? "crew" : "requested";
      setDrops((prev) => prev.map((d) => (d.author.id === drop.author.id ? { ...d, relationship: next } : d)));
      try {
        if (accept) await acceptCrewRequest(drop.author.id);
        else await sendCrewRequest(drop.author.id);
        toast(accept ? `You and ${drop.author.handle} are crew now` : `Crew request sent to ${drop.author.handle}`);
      } catch (err) {
        setDrops((prev) => prev.map((d) => (d.author.id === drop.author.id ? { ...d, relationship: drop.relationship } : d)));
        toast(err instanceof Error ? err.message : "Couldn't send that request");
      }
    },
    async onVote(drop, optionId) {
      patch(drop.id, (d) => ({
        ...d,
        poll: d.poll && {
          ...d.poll,
          myVote: optionId,
          totalVotes: d.poll.totalVotes + 1,
          options: d.poll.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
        },
      }));
      try {
        replace(await votePoll(drop.id, optionId));
      } catch {
        patch(drop.id, () => drop);
      }
    },
    async onStance(drop, stance) {
      const next = drop.take?.myStance === stance ? null : stance;
      patch(drop.id, (d) => {
        if (!d.take) return d;
        const t = { ...d.take };
        if (t.myStance) t[t.myStance] -= 1;
        if (next) t[next] += 1;
        return { ...d, take: { ...t, myStance: next } };
      });
      try {
        replace(await setStance(drop.id, next));
      } catch {
        patch(drop.id, () => drop);
      }
    },
    async onCopyLink(drop) {
      setMenuFor(null);
      await Clipboard.setStringAsync(dropLink(drop.id)).catch(() => {});
      toast("Link copied");
    },
    async onHide(drop, report) {
      setMenuFor(null);
      setDrops((prev) => prev.filter((d) => d.id !== drop.id));
      toast(report ? "Reported — thanks for flagging" : "Got it — less like this");
      hideDrop(drop.id, report).catch(() => {});
    },
    onOpenMoment(authorId) {
      options.onOpenMoment?.(authorId);
    },
    onOpenProfile(handle) {
      if (handle === user?.handle) navigation.navigate("Tabs", { screen: "Me" });
      else navigation.navigate("UserProfile", { handle });
    },
    onToggleMenu(dropId) {
      setMenuFor(dropId);
    },
  };

  const actions = useMemo<PostActions>(
    () => ({
      onLike: (d, f) => impl.current.onLike(d, f),
      onSave: (d) => impl.current.onSave(d),
      onComments: (d) => impl.current.onComments(d),
      onShare: (d) => impl.current.onShare(d),
      onFollow: (d) => impl.current.onFollow(d),
      onVote: (d, o) => impl.current.onVote(d, o),
      onStance: (d, s) => impl.current.onStance(d, s),
      onCopyLink: (d) => impl.current.onCopyLink(d),
      onHide: (d, r) => impl.current.onHide(d, r),
      onOpenMoment: (a) => impl.current.onOpenMoment(a),
      onOpenProfile: (h) => impl.current.onOpenProfile(h),
      onToggleMenu: (id) => impl.current.onToggleMenu(id),
    }),
    []
  );

  const sheets = (
    <>
      <CommentsModal
        visible={!!commentsFor}
        dropId={commentsFor?.id ?? ""}
        onClose={() => setCommentsFor(null)}
        onCommented={() => commentsFor && patch(commentsFor.id, (d) => ({ ...d, counts: { ...d.counts, replies: d.counts.replies + 1 } }))}
      />
      <ShareSheet
        drop={shareFor}
        onClose={() => setShareFor(null)}
        onShared={(d) => patch(d.id, (x) => ({ ...x, counts: { ...x.counts, shares: x.counts.shares + 1 } }))}
      />
    </>
  );

  return { actions, menuFor, setMenuFor, followedNow, sheets };
}

// Lift the card whose "…" menu is open above the cards below it (cells are
// siblings, so zIndex has to be set on the cell itself). Context keeps the
// renderer a stable component so cells never remount.
export const OpenMenuContext = createContext<string | null>(null);

export function PostCell({ item, style, children, ...rest }: { item: StreamDrop; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const openMenu = useContext(OpenMenuContext);
  return (
    <View {...rest} style={[style, item.id === openMenu && { zIndex: 20, elevation: 20 }]}>
      {children}
    </View>
  );
}
