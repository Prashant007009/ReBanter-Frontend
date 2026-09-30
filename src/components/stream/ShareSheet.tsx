import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { stream, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { PopIn } from "@/components/chat/MessageBubble";
import { getMyCrew } from "@/api/crew";
import { reactToDrop } from "@/api/drops";
import { sendDirect } from "@/api/direct";
import type { StreamDrop, UserSummary } from "@/api/types";
import { BottomSheet } from "./BottomSheet";
import { CheckGlyph } from "./StreamIcons";
import { dropLink } from "./format";
import { useToast } from "./Toast";

/** "Send to": pick crewmates and send them the drop over (encrypted) Direct, or copy its link. */
export function ShareSheet({ drop, onClose, onShared }: { drop: StreamDrop | null; onClose: () => void; onShared: (drop: StreamDrop) => void }) {
  const toast = useToast();
  const [friends, setFriends] = useState<UserSummary[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const picked = friends?.filter((f) => selected[f.id]) ?? [];

  useEffect(() => {
    if (!drop) return;
    setSelected({});
    getMyCrew()
      .then((crew) => setFriends(crew.slice(0, 8)))
      .catch(() => setFriends([]));
  }, [drop]);

  async function copyLink() {
    if (!drop) return;
    await Clipboard.setStringAsync(dropLink(drop.id)).catch(() => {});
    onClose();
    toast("Link copied");
  }

  async function send() {
    if (!drop || picked.length === 0 || sending) return;
    setSending(true);
    const results = await Promise.allSettled(picked.map((f) => sendDirect(f.id, { kind: "drop", dropId: drop.id, body: drop.caption ?? undefined })));
    const sent = results.filter((r) => r.status === "fulfilled").length;
    setSending(false);
    if (sent > 0) {
      reactToDrop(drop.id, "repost").catch(() => {});
      onShared(drop);
    }
    onClose();
    toast(sent === picked.length ? `Sent to ${sent} ${sent > 1 ? "people" : "person"}` : `Sent to ${sent} of ${picked.length} — try the rest again`);
  }

  return (
    <BottomSheet visible={!!drop} onClose={onClose} title="Send to">
      {friends === null ? (
        <ActivityIndicator style={{ marginVertical: 30 }} color={stream.inkMuted} />
      ) : friends.length === 0 ? (
        <Text style={styles.empty}>Add people to your crew to send them drops.</Text>
      ) : (
        <View style={styles.grid}>
          {friends.map((f) => (
            <Pressable key={f.id} style={styles.friend} onPress={() => setSelected((s) => ({ ...s, [f.id]: !s[f.id] }))} accessibilityLabel={`Send to ${f.handle}`}>
              <View>
                <Avatar handle={f.handle} displayName={f.displayName} avatarUrl={f.avatarUrl} size={58} radius={20} />
                {selected[f.id] ? (
                  <PopIn style={styles.check}>
                    <CheckGlyph size={11} color={stream.onLime} strokeWidth={4} />
                  </PopIn>
                ) : null}
              </View>
              <Text style={styles.friendHandle} numberOfLines={1}>
                {f.handle}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.buttons}>
        <Pressable style={styles.copy} onPress={copyLink}>
          <Text style={styles.copyText}>Copy link</Text>
        </Pressable>
        <Pressable style={[styles.send, { backgroundColor: picked.length ? stream.lime : stream.raisedHover }]} onPress={send} disabled={!picked.length || sending}>
          {sending ? (
            <ActivityIndicator color={stream.onLime} />
          ) : (
            <Text style={[styles.sendText, { color: picked.length ? stream.onLime : stream.inkFaint }]}>{picked.length ? `Send · ${picked.length}` : "Send"}</Text>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 18 },
  friend: { width: "25%", alignItems: "center", gap: 6 },
  friendHandle: { maxWidth: "92%", fontFamily: fonts.body, fontSize: 12, color: stream.inkSoft },
  check: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: stream.lime,
    borderWidth: 3,
    borderColor: stream.sheet,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { fontFamily: fonts.body, fontSize: 13.5, color: stream.inkMuted, textAlign: "center", paddingHorizontal: 30, paddingVertical: 24 },
  buttons: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  copy: { flex: 1, height: 48, borderRadius: 16, borderWidth: 1, borderColor: stream.raisedBorder, backgroundColor: stream.raised, alignItems: "center", justifyContent: "center" },
  copyText: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  send: { flex: 1, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sendText: { fontFamily: fonts.bodySemibold, fontSize: 14.5 },
});
