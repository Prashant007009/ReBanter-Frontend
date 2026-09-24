import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { stream, fonts } from "@/theme/colors";
import { uploadLocalAsset } from "@/api/media";
import { createMoment } from "@/api/moments";
import { useToast } from "@/components/stream/Toast";
import { PhotoIcon } from "@/components/chat/ChatIcons";
import type { RootStackParamList } from "@/navigation/types";

const STYLES = [
  { bg: "#C8F169", ink: "#0C0C0E" },
  { bg: "#F5F3EF", ink: "#0C0C0E" },
  { bg: "#0C0C0E", ink: "#F5F3EF" },
  { bg: "#1FB7A6", ink: "#0C0C0E" },
  { bg: "#FF7AB6", ink: "#0C0C0E" },
  { bg: "#B36CFF", ink: "#FFFFFF" },
];

type Props = NativeStackScreenProps<RootStackParamList, "NewMoment">;

/** Compose a 24-hour Moment: a photo, a caption sticker, or both. */
export function NewMomentScreen({ navigation }: Props) {
  const toast = useToast();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [styleIndex, setStyleIndex] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const style = STYLES[styleIndex];
  const canShare = !!photo || caption.trim().length > 0;

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to add a photo");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  async function share() {
    if (!canShare || isSharing) return;
    setIsSharing(true);
    setError(null);
    try {
      const mediaUrl = photo ? await uploadLocalAsset(photo.uri, photo.mimeType ?? "image/jpeg") : undefined;
      await createMoment({
        mediaUrl,
        caption: caption.trim() || undefined,
        captionBg: caption.trim() ? style.bg : undefined,
        captionInk: caption.trim() ? style.ink : undefined,
      });
      toast("Moment shared · gone in 24h");
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't share that moment");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New moment</Text>
        <Pressable style={[styles.primary, !canShare && styles.primaryOff]} onPress={share} disabled={!canShare || isSharing}>
          {isSharing ? <ActivityIndicator color={stream.onLime} size="small" /> : <Text style={[styles.primaryText, !canShare && { color: stream.inkFaint }]}>Share</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.preview} onPress={pickPhoto} accessibilityLabel={photo ? "Change photo" : "Add a photo"}>
          {photo ? <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          {!photo ? (
            <View style={styles.previewHint}>
              <PhotoIcon size={28} color={stream.inkMuted} />
              <Text style={styles.previewHintText}>Tap to add a photo (optional)</Text>
            </View>
          ) : null}
          {caption.trim() ? (
            <View style={styles.stickerWrap} pointerEvents="none">
              <Text style={[styles.sticker, { backgroundColor: style.bg, color: style.ink }]}>{caption.trim()}</Text>
            </View>
          ) : null}
        </Pressable>

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption sticker…"
          placeholderTextColor="#8C8A94"
          maxLength={120}
          style={styles.input}
        />
        <View style={styles.swatches}>
          {STYLES.map((s, i) => (
            <Pressable
              key={s.bg}
              onPress={() => setStyleIndex(i)}
              style={[styles.swatch, { backgroundColor: s.bg, borderColor: i === styleIndex ? stream.lime : stream.raisedBorder }]}
              accessibilityLabel={`Sticker colour ${i + 1}`}
            >
              <Text style={{ color: s.ink, fontFamily: fonts.display, fontSize: 14 }}>Aa</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.note}>Your crew sees moments at the top of Stream for 24 hours.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg, paddingTop: 52 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: stream.inkMuted },
  title: { fontFamily: fonts.display, fontSize: 17, color: stream.ink },
  primary: { minWidth: 76, height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: stream.lime, alignItems: "center", justifyContent: "center" },
  primaryOff: { backgroundColor: stream.raisedHover },
  primaryText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.onLime },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  preview: { height: 420, borderRadius: 24, overflow: "hidden", backgroundColor: stream.card, borderWidth: 1, borderColor: stream.cardBorder, alignItems: "center", justifyContent: "center" },
  previewHint: { alignItems: "center", gap: 10 },
  previewHintText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: stream.inkMuted },
  stickerWrap: { position: "absolute", left: 24, right: 24, top: "44%", alignItems: "center" },
  sticker: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: "hidden",
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 29,
    textAlign: "center",
    transform: [{ rotate: "-2deg" }],
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: stream.raised,
    borderWidth: 1,
    borderColor: stream.raisedBorder,
    color: stream.ink,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  swatches: { flexDirection: "row", gap: 10 },
  swatch: { width: 44, height: 44, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: stream.redSoft },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: stream.inkMuted },
});
