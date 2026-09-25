import { memo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { stream, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { PopIn } from "@/components/chat/MessageBubble";
import { takeTheme } from "@/components/stream/format";
import type { Notification, UserSummary } from "@/api/types";

/** Several notifications shown as one card (cheers on the same drop collapse together). */
export type PulseItem = {
  key: string;
  ids: string[];
  type: Notification["type"];
  actors: UserSummary[];
  createdAt: string;
  unread: boolean;
  drop: Notification["drop"];
  reply: Notification["reply"];
  crew: Notification["crew"];
  dropId: string | null;
};

export type CrewUi = "pending" | "accepted" | "skipped" | "skipping";

const TYPE = {
  REPLY: { badge: "#7B9CFF", tint: "rgba(123,156,255,0.07)" },
  CHEER: { badge: "#FF7AB6", tint: "rgba(255,122,182,0.07)" },
  CREW_REQUEST: { badge: "#C8F169", tint: "rgba(200,241,105,0.06)" },
  CREW_JOINED: { badge: "#C8F169", tint: "rgba(200,241,105,0.06)" },
  MENTION: { badge: "#FFB020", tint: "rgba(255,176,32,0.07)" },
} as const;

const QUICK = ["😂", "🔥", "haha facts"];

export function shortAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

function verb(item: PulseItem) {
  const others = item.actors.length - 1;
  switch (item.type) {
    case "CHEER":
      return others > 0 ? `and ${others} other${others > 1 ? "s" : ""} cheered your ${item.drop?.kind === "take" ? "take" : "drop"}` : `cheered your ${item.drop?.kind === "take" ? "take" : "drop"}`;
    case "REPLY":
      return item.reply?.parentId ? "replied to your comment" : "replied to your drop";
    case "MENTION":
      return item.reply ? "mentioned you in a comment" : item.drop?.kind === "take" ? "mentioned you in a take" : item.drop?.kind === "poll" ? "mentioned you in a poll" : "mentioned you in a drop";
    case "CREW_REQUEST":
      return "wants to join your crew";
    case "CREW_JOINED":
      return "is now in your crew";
  }
}

function Badge({ type }: { type: PulseItem["type"] }) {
  const ink = stream.onLime;
  return (
    <View style={[styles.badge, { backgroundColor: TYPE[type].badge }]}>
      {type === "REPLY" ? (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M10 6L4 12l6 6" />
          <Path d="M4 12h10a6 6 0 0 1 6 6" />
        </Svg>
      ) : type === "CHEER" ? (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill={ink}>
          <Path d="M12 20.5s-7.5-4.4-9.3-9.2C1.5 7.9 3.8 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.8 1.3-1.7 2.8-2.8 4.8-2.8 3.4 0 5.7 3.4 4.5 6.8-1.8 4.8-9.3 9.2-9.3 9.2z" />
        </Svg>
      ) : type === "MENTION" ? (
        <Text style={styles.at}>@</Text>
      ) : (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={3.4} strokeLinecap="round">
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      )}
    </View>
  );
}

export const PulseCard = memo(function PulseCard({
  item,
  crewUi,
  sentReply,
  onOpen,
  onReply,
  onLetIn,
  onSkip,
  onUndoSkip,
  onSayHi,
}: {
  item: PulseItem;
  crewUi: CrewUi | undefined;
  sentReply: string | undefined;
  onOpen: (item: PulseItem) => void;
  onReply: (item: PulseItem, text: string) => Promise<void>;
  onLetIn: (item: PulseItem) => void;
  onSkip: (item: PulseItem) => void;
  onUndoSkip: (item: PulseItem) => void;
  onSayHi: (item: PulseItem) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const who = item.actors[0];
  const second = item.actors[1];
  const quote = item.reply?.body ?? (item.type === "MENTION" ? item.drop?.body ?? item.drop?.caption : null) ?? null;
  const canReply = (item.type === "REPLY" || item.type === "MENTION") && !!item.dropId && (!!item.reply || item.type === "MENTION");
  const thumb = item.drop && item.type !== "CREW_REQUEST" && item.type !== "CREW_JOINED" ? item.drop : null;
  const crew = crewUi ?? (item.crew?.status as CrewUi | undefined) ?? "pending";

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onReply(item, text.trim());
      setReplyOpen(false);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={[styles.card, { backgroundColor: item.unread ? TYPE[item.type].tint : "#111114", borderColor: item.unread ? stream.raisedHover : "#18181C" }]}
      accessibilityLabel={`${who?.handle ?? "Someone"} ${verb(item)}`}
    >
      <View style={styles.avatarWrap}>
        {who ? <Avatar handle={who.handle} displayName={who.displayName} avatarUrl={who.avatarUrl} size={46} radius={16} /> : <View style={styles.avatarGhost} />}
        {second ? (
          <View style={styles.second}>
            <Avatar handle={second.handle} displayName={second.displayName} avatarUrl={second.avatarUrl} size={21} radius={8} />
          </View>
        ) : null}
        <Badge type={item.type} />
      </View>

      <View style={styles.body}>
        <Text style={styles.line}>
          <Text style={styles.who}>{who?.handle ?? "Someone"}</Text> <Text style={styles.verb}>{verb(item)}</Text>{" "}
          <Text style={styles.ago}>· {shortAgo(item.createdAt)}</Text>
        </Text>

        {quote ? (
          <Text style={styles.quote} numberOfLines={4}>
            {quote}
          </Text>
        ) : null}

        {canReply ? (
          sentReply ? (
            <Text style={styles.sent}>✓ You replied: {sentReply}</Text>
          ) : replyOpen ? (
            <PopIn style={styles.replyBox}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => send(draft)}
                placeholder={`Reply to ${who?.handle ?? ""}…`}
                placeholderTextColor="#8C8A94"
                autoFocus
                returnKeyType="send"
                style={styles.replyInput}
              />
              <Pressable style={styles.replySend} onPress={() => send(draft)} disabled={sending} accessibilityLabel="Send reply">
                {sending ? (
                  <ActivityIndicator size="small" color={stream.onLime} />
                ) : (
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill={stream.onLime}>
                    <Path d="M3.5 11.2L20 3.8c.6-.3 1.2.3.9.9l-7.4 16.5c-.3.6-1.2.6-1.4-.1l-1.9-6.3-6.4-2.1c-.7-.2-.7-1.2-.1-1.5z" />
                  </Svg>
                )}
              </Pressable>
            </PopIn>
          ) : (
            <View style={styles.quickRow}>
              {QUICK.map((q) => (
                <Pressable key={q} style={({ pressed }) => [styles.quick, pressed && { backgroundColor: stream.raised }]} onPress={() => send(q)} disabled={sending}>
                  <Text style={styles.quickText}>{q}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.replyButton} onPress={() => setReplyOpen(true)}>
                <Text style={styles.replyButtonText}>Reply</Text>
              </Pressable>
            </View>
          )
        ) : null}

        {item.type === "CREW_REQUEST" ? (
          crew === "pending" ? (
            <View style={styles.crewRow}>
              <Pressable style={styles.letIn} onPress={() => onLetIn(item)}>
                <Text style={styles.letInText}>Let in</Text>
              </Pressable>
              <Pressable style={styles.skip} onPress={() => onSkip(item)}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              {item.crew?.mutuals ? (
                <Text style={styles.mutual}>
                  {item.crew.mutuals} mutual{item.crew.mutuals > 1 ? "s" : ""}
                </Text>
              ) : null}
            </View>
          ) : crew === "accepted" ? (
            <PopIn style={styles.inCrew}>
              <Text style={styles.inCrewText}>✓ In your crew · </Text>
              <Pressable onPress={() => onSayHi(item)} hitSlop={6}>
                <Text style={[styles.inCrewText, styles.underline]}>Say hi</Text>
              </Pressable>
            </PopIn>
          ) : (
            <View style={styles.crewRow}>
              <Text style={styles.skipped}>Request skipped</Text>
              {crew === "skipping" ? (
                <Pressable onPress={() => onUndoSkip(item)} hitSlop={6}>
                  <Text style={[styles.skipped, styles.undo]}> · Undo</Text>
                </Pressable>
              ) : null}
            </View>
          )
        ) : null}

        {item.type === "CREW_JOINED" ? (
          <Pressable onPress={() => onSayHi(item)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
            <Text style={[styles.inCrewText, styles.underline]}>Say hi</Text>
          </Pressable>
        ) : null}
      </View>

      {thumb ? (
        thumb.thumbUrl ? (
          <Image source={{ uri: thumb.thumbUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: thumb.kind === "take" ? takeTheme(thumb.id).bg : stream.card, padding: 5 }]}>
            <Text style={[styles.thumbText, { color: thumb.kind === "take" ? takeTheme(thumb.id).ink : stream.ink }]} numberOfLines={4}>
              {thumb.body ?? thumb.caption}
            </Text>
          </View>
        )
      ) : null}
      {item.unread ? <View style={[styles.dot, { right: thumb ? 66 : 14 }]} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 12, paddingVertical: 12, paddingLeft: 10, paddingRight: 12, borderRadius: 20, borderWidth: 1 },
  avatarWrap: { width: 46, height: 46 },
  avatarGhost: { width: 46, height: 46, borderRadius: 16, backgroundColor: stream.raised },
  second: { position: "absolute", left: -6, top: -6, borderWidth: 2.5, borderColor: stream.bg, borderRadius: 10 },
  badge: { position: "absolute", right: -5, bottom: -5, width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: stream.bg, alignItems: "center", justifyContent: "center" },
  at: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 12, color: stream.onLime },
  body: { flex: 1, minWidth: 0, gap: 6 },
  line: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: stream.ink, paddingRight: 14 },
  who: { fontFamily: fonts.bodySemibold },
  verb: { color: stream.inkSoft },
  ago: { color: stream.inkFaint, fontSize: 12.5 },
  quote: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    overflow: "hidden",
    backgroundColor: "#1E1E23",
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 18,
    color: stream.ink,
  },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quick: { height: 30, paddingHorizontal: 10, borderWidth: 1, borderColor: stream.raisedBorder, borderRadius: 10, justifyContent: "center" },
  quickText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: stream.ink },
  replyButton: { height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#1E1E23", justifyContent: "center" },
  replyButtonText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.lime },
  replyBox: { flexDirection: "row", alignItems: "center", height: 38, paddingLeft: 12, paddingRight: 4, backgroundColor: stream.raised, borderWidth: 1.5, borderColor: stream.lime, borderRadius: 12 },
  replyInput: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 13.5, color: stream.ink, paddingVertical: 0 },
  replySend: { width: 30, height: 30, borderRadius: 9, backgroundColor: stream.lime, alignItems: "center", justifyContent: "center" },
  sent: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: stream.lime },
  crewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  letIn: { height: 36, paddingHorizontal: 18, borderRadius: 12, backgroundColor: stream.lime, justifyContent: "center" },
  letInText: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: stream.onLime },
  skip: { height: 36, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "#2E2E35", justifyContent: "center" },
  skipText: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: stream.ink },
  mutual: { fontFamily: fonts.body, fontSize: 12, color: stream.inkFaint },
  inCrew: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", height: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(200,241,105,0.12)" },
  inCrewText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.lime },
  underline: { textDecorationLine: "underline" },
  skipped: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkFaint },
  undo: { color: stream.ink, fontFamily: fonts.bodySemibold, textDecorationLine: "underline" },
  thumb: { width: 48, height: 60, borderRadius: 12, overflow: "hidden", alignSelf: "flex-start" },
  thumbText: { fontFamily: fonts.display, fontSize: 8.5, lineHeight: 10 },
  dot: { position: "absolute", top: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: stream.lime, shadowColor: stream.lime, shadowOpacity: 0.5, shadowRadius: 3 },
});
