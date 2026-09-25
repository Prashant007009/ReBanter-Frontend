import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";
import QRCode from "react-native-qrcode-svg";
import { stream, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { BottomSheet } from "@/components/stream/BottomSheet";
import { profileCode } from "@/components/roam/ScanSheet";
import { checkHandle } from "@/api/me";
import type { UserSummary } from "@/api/types";

export function profileLink(handle: string) {
  return `https://rebanter.app/${handle}`;
}

// ---- Edit profile ----------------------------------------------------------

export type EditDraft = { displayName: string; handle: string; bio: string };

export function EditProfileSheet({
  visible,
  initial,
  onClose,
  onSave,
  onChangePhoto,
  onChangeCover,
}: {
  visible: boolean;
  initial: EditDraft;
  onClose: () => void;
  onSave: (draft: EditDraft) => Promise<void>;
  onChangePhoto: () => void;
  onChangeCover: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [handleState, setHandleState] = useState<{ ok: boolean; label: string }>({ ok: true, label: "" });
  const [saving, setSaving] = useState(false);

  // Reset to the saved profile each time the sheet opens.
  const initialRef = useRef(initial);
  initialRef.current = initial;
  useEffect(() => {
    if (!visible) return;
    setDraft(initialRef.current);
    setHandleState({ ok: true, label: "" });
  }, [visible]);

  // Debounced availability check whenever the username changes.
  useEffect(() => {
    if (!visible) return;
    const h = draft.handle;
    if (h === initial.handle) {
      setHandleState({ ok: true, label: "" });
      return;
    }
    if (h.length < 3) {
      setHandleState({ ok: false, label: "too short" });
      return;
    }
    setHandleState({ ok: false, label: "checking…" });
    const t = setTimeout(() => {
      checkHandle(h)
        .then((r) => setHandleState(r.available ? { ok: true, label: "✓ available" } : { ok: false, label: r.reason === "Taken" ? "taken" : "invalid" }))
        .catch(() => setHandleState({ ok: false, label: "couldn't check" }));
    }, 350);
    return () => clearTimeout(t);
  }, [draft.handle, visible, initial.handle]);

  async function save() {
    if (!handleState.ok || !draft.displayName.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ ...draft, displayName: draft.displayName.trim(), bio: draft.bio.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.pad}>
        <View style={styles.editHeader}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.sheetTitle}>Edit profile</Text>
          <Pressable onPress={save} hitSlop={8} disabled={saving || !handleState.ok}>
            {saving ? <ActivityIndicator color={stream.lime} size="small" /> : <Text style={[styles.save, !handleState.ok && { opacity: 0.4 }]}>Save</Text>}
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <View style={styles.photoRow}>
            <Pressable style={styles.photoButton} onPress={onChangePhoto}>
              <Text style={styles.photoButtonText}>🙂 Change photo</Text>
            </Pressable>
            <Pressable style={styles.photoButton} onPress={onChangeCover}>
              <Text style={styles.photoButtonText}>🖼️ Change cover</Text>
            </Pressable>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Name</Text>
            <TextInput value={draft.displayName} onChangeText={(t) => setDraft((d) => ({ ...d, displayName: t }))} maxLength={60} style={styles.input} />
          </View>
          <View style={{ gap: 6 }}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Username</Text>
              <Text style={[styles.label, { color: handleState.ok ? stream.lime : stream.redSoft }]}>{handleState.label}</Text>
            </View>
            <View style={[styles.input, styles.handleBox]}>
              <Text style={{ color: stream.inkFaint, fontFamily: fonts.body, fontSize: 15 }}>@</Text>
              <TextInput
                value={draft.handle}
                onChangeText={(t) => setDraft((d) => ({ ...d, handle: t.replace(/[^a-z0-9._]/gi, "").toLowerCase().slice(0, 24) }))}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.handleInput}
              />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Bio</Text>
              <Text style={styles.label}>{draft.bio.length}/80</Text>
            </View>
            <TextInput
              value={draft.bio}
              onChangeText={(t) => setDraft((d) => ({ ...d, bio: t.slice(0, 80) }))}
              multiline
              maxLength={80}
              style={[styles.input, { height: 72, paddingTop: 12, textAlignVertical: "top" }]}
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

// ---- Share card ------------------------------------------------------------

const CARD_THEMES = ["#C8F169", "#FF7AB6", "#7B9CFF", "#F5F3EF"];

export function ShareCardSheet({
  visible,
  handle,
  onClose,
  onDirect,
  toast,
}: {
  visible: boolean;
  handle: string;
  onClose: () => void;
  onDirect: () => void;
  toast: (m: string) => void;
}) {
  const [theme, setTheme] = useState(0);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<View>(null);

  async function copy() {
    await Clipboard.setStringAsync(profileLink(handle)).catch(() => {});
    onClose();
    toast(`rebanter.app/${handle} copied`);
  }

  async function saveCard() {
    if (saving) return;
    setSaving(true);
    try {
      if (Platform.OS === "web") {
        const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "data-uri" });
        const a = document.createElement("a");
        a.href = uri;
        a.download = `rebanter-${handle}.png`;
        a.click();
      } else {
        // Loaded lazily: expo-media-library has no web build and crashes at import there.
        const MediaLibrary: typeof import("expo-media-library") = await import("expo-media-library");
        const perm = await MediaLibrary.requestPermissionsAsync(true);
        if (!perm.granted) {
          toast("Allow photo access to save your card");
          return;
        }
        const uri = await captureRef(cardRef, { format: "png", quality: 1 });
        await MediaLibrary.saveToLibraryAsync(uri);
      }
      onClose();
      toast(Platform.OS === "web" ? "Card downloaded" : "Card saved to photos");
    } catch {
      toast("Couldn't save the card");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.pad, { alignItems: "center", gap: 14 }]}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {CARD_THEMES.map((c, i) => (
            <Pressable
              key={c}
              onPress={() => setTheme(i)}
              style={[styles.swatch, { backgroundColor: c, borderColor: theme === i ? stream.ink : "transparent" }]}
              accessibilityLabel={`Card colour ${i + 1}`}
            />
          ))}
        </View>
        <View ref={cardRef} collapsable={false} style={[styles.card, { backgroundColor: CARD_THEMES[theme] }]}>
          <View style={styles.cardQr}>
            <QRCode value={profileCode(handle)} size={130} color={CARD_THEMES[theme]} backgroundColor={stream.bg} />
          </View>
          <Text style={styles.cardHandle}>@{handle}</Text>
          <Text style={styles.cardTag}>SCAN TO TUNE IN</Text>
        </View>
        <View style={styles.shareGrid}>
          <ShareButton icon="🔗" label="Copy link" onPress={copy} />
          <ShareButton icon="💬" label="Direct" onPress={onDirect} />
          <ShareButton icon="⬇️" label={saving ? "Saving…" : "Save card"} onPress={saveCard} />
        </View>
      </View>
    </BottomSheet>
  );
}

function ShareButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.shareButton, pressed && { backgroundColor: stream.raisedHover }]} onPress={onPress} accessibilityLabel={label}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={styles.shareButtonText}>{label}</Text>
    </Pressable>
  );
}

// ---- Menu ----------------------------------------------------------------

export function MenuSheet({
  visible,
  isPrivate,
  onClose,
  onSettings,
  onSaved,
  onActivity,
  onTogglePrivate,
  onLogOut,
}: {
  visible: boolean;
  isPrivate: boolean;
  onClose: () => void;
  onSettings: () => void;
  onSaved: () => void;
  onActivity: () => void;
  onTogglePrivate: () => void;
  onLogOut: () => void;
}) {
  const rows: { icon: string; label: string; on: () => void; toggle?: boolean; danger?: boolean }[] = [
    { icon: "⚙️", label: "Settings", on: onSettings },
    { icon: "🔖", label: "Saved", on: onSaved },
    { icon: "🕘", label: "Your activity", on: onActivity },
    { icon: "🔒", label: "Private profile", on: onTogglePrivate, toggle: true },
    { icon: "🚪", label: "Log out", on: onLogOut, danger: true },
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.pad, { gap: 2 }]}>
        {rows.map((r) => (
          <Pressable key={r.label} onPress={r.on} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: stream.raised }]} accessibilityLabel={r.label}>
            <View style={styles.menuIcon}>
              <Text style={{ fontSize: 16 }}>{r.icon}</Text>
            </View>
            <Text style={[styles.menuLabel, r.danger && { color: stream.redSoft }]}>{r.label}</Text>
            {r.toggle ? (
              <View style={[styles.toggle, { backgroundColor: isPrivate ? stream.lime : stream.ringSeen }]}>
                <View style={[styles.knob, { left: isPrivate ? 19 : 3 }]} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

// ---- Crew list -------------------------------------------------------------

export function CrewSheet({
  visible,
  crew,
  onClose,
  onMessage,
  onOpenProfile,
}: {
  visible: boolean;
  crew: (UserSummary & { since: string })[] | null;
  onClose: () => void;
  onMessage: (u: UserSummary) => void;
  onOpenProfile: (u: UserSummary) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Crew · ${crew?.length ?? 0}`}>
      <View style={[styles.pad, { gap: 4 }]}>
        {crew === null ? <ActivityIndicator color={stream.inkMuted} style={{ marginVertical: 20 }} /> : null}
        {crew && crew.length === 0 ? (
          <View style={{ alignItems: "center", gap: 6, paddingVertical: 20 }}>
            <Text style={styles.emptyTitle}>No one tuned in yet</Text>
            <Text style={styles.emptySub}>Share your card to get your first listeners.</Text>
          </View>
        ) : null}
        {crew?.map((p) => (
          <View key={p.id} style={styles.crewRow}>
            <Pressable onPress={() => onOpenProfile(p)} style={styles.crewWho}>
              <Avatar handle={p.handle} displayName={p.displayName} avatarUrl={p.avatarUrl} size={44} radius={15} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.crewHandle}>{p.handle}</Text>
                <Text style={styles.crewSub}>In your crew since {new Date(p.since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</Text>
              </View>
            </Pressable>
            <Pressable style={styles.messageButton} onPress={() => onMessage(p)} accessibilityLabel={`Message ${p.handle}`}>
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

// ---- New pin ---------------------------------------------------------------

const PIN_EMOJI = ["🏎️", "🛠️", "🏔️", "☕", "🎧", "📸", "🍜", "✈️", "🎨", "⚽", "🌿", "🎬"];
const PIN_COLORS = ["#1FB7A6", "#C8F169", "#7B9CFF", "#FFB020", "#FF7AB6", "#B36CFF"];

export function NewPinSheet({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (pin: { emoji: string; label: string; color: string }) => Promise<void> }) {
  const [emoji, setEmoji] = useState(PIN_EMOJI[0]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(PIN_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setLabel("");
      setEmoji(PIN_EMOJI[0]);
      setColor(PIN_COLORS[0]);
    }
  }, [visible]);

  async function create() {
    if (!label.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate({ emoji, label: label.trim(), color });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="New pin">
      <View style={[styles.pad, { gap: 14 }]}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <View style={[styles.pinPreview, { backgroundColor: color }]}>
            <Text style={{ fontSize: 26 }}>{emoji}</Text>
          </View>
          <Text style={styles.emptySub}>Pins filter your drops by #{label.trim() || "label"}.</Text>
        </View>
        <View style={styles.emojiGrid}>
          {PIN_EMOJI.map((e) => (
            <Pressable key={e} onPress={() => setEmoji(e)} style={[styles.emojiCell, emoji === e && { backgroundColor: stream.raisedHover, borderColor: stream.lime }]}>
              <Text style={{ fontSize: 20 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={label} onChangeText={(t) => setLabel(t.replace(/[^\p{L}\p{N}_ ]/gu, "").slice(0, 24))} placeholder="Label (e.g. Cars)" placeholderTextColor="#8C8A94" style={styles.input} />
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
          {PIN_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c, borderColor: color === c ? stream.ink : "transparent" }]} />
          ))}
        </View>
        <Pressable style={[styles.primary, !label.trim() && { backgroundColor: stream.raisedHover }]} onPress={create} disabled={!label.trim() || saving}>
          {saving ? <ActivityIndicator color={stream.onLime} /> : <Text style={[styles.primaryText, !label.trim() && { color: stream.inkFaint }]}>Pin it</Text>}
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16 },
  editHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 14 },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: stream.inkMuted },
  sheetTitle: { fontFamily: fonts.display, fontSize: 16, color: stream.ink },
  save: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.lime },
  photoRow: { flexDirection: "row", gap: 8 },
  photoButton: { flex: 1, height: 40, borderRadius: 12, backgroundColor: stream.raised, borderWidth: 1, borderColor: stream.raisedBorder, alignItems: "center", justifyContent: "center" },
  photoButtonText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.ink },
  label: { fontFamily: fonts.bodySemibold, fontSize: 12, color: stream.inkMuted },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  input: { height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: stream.raisedBorder, borderRadius: 14, backgroundColor: stream.raised, color: stream.ink, fontFamily: fonts.body, fontSize: 15 },
  handleBox: { flexDirection: "row", alignItems: "center" },
  handleInput: { flex: 1, minWidth: 0, color: stream.ink, fontFamily: fonts.body, fontSize: 15, paddingVertical: 0 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  card: { width: 230, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderRadius: 30, alignItems: "center", gap: 12 },
  cardQr: { padding: 10, borderRadius: 18, backgroundColor: stream.bg },
  cardHandle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4, color: stream.onLime },
  cardTag: { fontFamily: fonts.bodySemibold, fontSize: 11.5, letterSpacing: 1.4, color: stream.onLime },
  shareGrid: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  shareButton: { flex: 1, height: 64, borderRadius: 18, borderWidth: 1, borderColor: stream.raisedBorder, backgroundColor: stream.raised, alignItems: "center", justifyContent: "center", gap: 4 },
  shareButtonText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.ink },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, height: 52, paddingHorizontal: 10, borderRadius: 14 },
  menuIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: stream.raised, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: stream.ink },
  toggle: { width: 40, height: 24, borderRadius: 12 },
  knob: { position: "absolute", top: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: stream.ink },
  crewRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  crewWho: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  crewHandle: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  crewSub: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
  messageButton: { height: 32, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: stream.ringSeen, justifyContent: "center" },
  messageText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.ink },
  emptyTitle: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: stream.inkMuted, textAlign: "center" },
  pinPreview: { width: 60, height: 60, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  emojiCell: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  primary: { height: 46, borderRadius: 15, backgroundColor: stream.lime, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: stream.onLime },
});
