import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { uploadLocalAsset } from "@/api/media";
import { apiFetch } from "@/api/client";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "NewDrop">;

export function NewDropScreen({ navigation }: Props) {
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [alsoLoop, setAlsoLoop] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to pick a drop");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      aspect: [4, 5],
      allowsEditing: true,
    });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function onPublish() {
    if (!image) {
      setError("Add a photo before publishing");
      return;
    }
    setError(null);
    setIsPublishing(true);
    try {
      const contentType = image.mimeType ?? "image/jpeg";
      const url = await uploadLocalAsset(image.uri, contentType);
      await apiFetch("/api/drops", {
        method: "POST",
        body: JSON.stringify({
          caption: caption.trim() || undefined,
          location: place.trim() || undefined,
          media: [{ url, kind: "image" }],
        }),
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.headerAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New drop</Text>
        <Pressable onPress={onPublish} disabled={isPublishing}>
          {isPublishing ? <ActivityIndicator color={colors.accent} /> : <Text style={[styles.headerAction, styles.publish]}>Publish</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.mediaPicker} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.mediaPreview} />
        ) : (
          <Text style={styles.mediaPickerText}>Tap to add a photo · 4:5</Text>
        )}
      </Pressable>
      <View style={styles.mediaTagsRow}>
        <Text style={styles.mediaTag}>Ratio 4:5</Text>
        <Text style={styles.mediaTag}>Tone: Dusk</Text>
      </View>

      <TextInput
        style={styles.captionInput}
        placeholder="Say something worth bantering about…"
        placeholderTextColor={colors.inkFaint}
        value={caption}
        onChangeText={setCaption}
        multiline
      />

      <TextInput
        style={styles.input}
        placeholder="Add place"
        placeholderTextColor={colors.inkFaint}
        value={place}
        onChangeText={setPlace}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Also share as Loop</Text>
        <Switch value={alsoLoop} onValueChange={setAlsoLoop} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 56, paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  headerAction: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.inkMuted },
  publish: { color: colors.accent, fontFamily: fonts.bodyBold },
  headerTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.ink },
  mediaPicker: {
    aspectRatio: 4 / 5,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mediaPreview: { width: "100%", height: "100%" },
  mediaPickerText: { fontFamily: fonts.body, color: colors.inkFaint },
  mediaTagsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  mediaTag: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.inkMuted, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  captionInput: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginTop: 16, minHeight: 60 },
  input: {
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    marginTop: 12,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  toggleLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  error: { color: colors.cheer, marginTop: 14, textAlign: "center" },
});
