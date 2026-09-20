import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { PinIcon, UsersIcon, VideoIcon, ClockIcon } from "@/assets/icons";
import { Toggle } from "@/components/Toggle";
import { PeoplePickerModal } from "@/components/PeoplePickerModal";
import { uploadLocalAsset } from "@/api/media";
import { apiFetch } from "@/api/client";
import type { UserSummary } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  return matches ? [...new Set(matches)] : [];
}

type Props = NativeStackScreenProps<RootStackParamList, "NewDrop">;

export function NewDropScreen({ navigation }: Props) {
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [alsoLoop, setAlsoLoop] = useState(false);
  const [taggedCrew, setTaggedCrew] = useState<UserSummary[]>([]);
  const [crewPickerVisible, setCrewPickerVisible] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hashtags = useMemo(() => extractHashtags(caption), [caption]);

  function toggleCrewTag(person: UserSummary) {
    setTaggedCrew((prev) => (prev.some((p) => p.id === person.id) ? prev.filter((p) => p.id !== person.id) : [...prev, person]));
  }

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
      const mentions = taggedCrew.map((p) => `@${p.handle}`).join(" ");
      const fullCaption = [caption.trim(), mentions].filter(Boolean).join(" ");
      await apiFetch("/api/drops", {
        method: "POST",
        body: JSON.stringify({
          caption: fullCaption || undefined,
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
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New drop</Text>
        <Pressable style={styles.publishButton} onPress={onPublish} disabled={isPublishing}>
          {isPublishing ? <ActivityIndicator color={colors.surfaceRaised} size="small" /> : <Text style={styles.publishText}>Publish</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.mediaPicker} onPress={pickImage}>
        {image ? <Image source={{ uri: image.uri }} style={styles.mediaPreview} /> : null}
        <View style={styles.mediaTagsRow}>
          <Text style={styles.mediaTag}>Ratio 4:5</Text>
          <Text style={styles.mediaTag}>Tone: Dusk</Text>
        </View>
        {!image ? <Text style={styles.mediaPickerHint}>Tap to add a photo</Text> : null}
      </Pressable>

      <View style={styles.captionCard}>
        <TextInput
          style={styles.captionInput}
          placeholder="Say something worth bantering about…"
          placeholderTextColor={colors.inkFaint}
          value={caption}
          onChangeText={setCaption}
          multiline
        />
        <View style={styles.captionFooter}>
          {hashtags.length > 0 ? (
            hashtags.map((tag) => (
              <Text key={tag} style={styles.hashtag}>
                {tag}
              </Text>
            ))
          ) : (
            <Text style={styles.hashtagHint}>Type #hashtags in your caption</Text>
          )}
          <View style={{ flex: 1 }} />
          <Text style={styles.charCount}>{caption.length} / 280</Text>
        </View>
      </View>

      <View style={styles.optionsCard}>
        <View style={styles.optionRow}>
          <PinIcon size={19} color={colors.ink} />
          <Text style={styles.optionLabel}>Add place</Text>
          <TextInput
            style={styles.optionInlineInput}
            placeholder="Alfama"
            placeholderTextColor={colors.inkFaint}
            value={place}
            onChangeText={setPlace}
          />
        </View>
        <Pressable style={[styles.optionRow, styles.optionDivider]} onPress={() => setCrewPickerVisible(true)}>
          <UsersIcon size={19} color={colors.ink} />
          <Text style={styles.optionLabel}>Tag crew</Text>
          <Text style={styles.optionValue}>{taggedCrew.length > 0 ? taggedCrew.length : "None"}</Text>
        </Pressable>
        <View style={[styles.optionRow, styles.optionDivider]}>
          <VideoIcon size={19} color={colors.ink} strokeWidth={1.8} />
          <Text style={styles.optionLabel}>Also share as Loop</Text>
          <Toggle value={alsoLoop} onChange={setAlsoLoop} />
        </View>
        <View style={[styles.optionRow, styles.optionDivider]}>
          <ClockIcon size={19} color={colors.ink} />
          <Text style={styles.optionLabel}>Schedule</Text>
          <Text style={styles.optionValue}>Off</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PeoplePickerModal
        visible={crewPickerVisible}
        title="Tag crew"
        onClose={() => setCrewPickerVisible(false)}
        onSelect={toggleCrewTag}
        selectedIds={taggedCrew.map((p) => p.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 56, paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  cancel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSubtle },
  headerTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.ink },
  publishButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, minWidth: 76, alignItems: "center" },
  publishText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.surfaceRaised },
  mediaPicker: {
    height: 254,
    marginBottom: 14,
    borderRadius: 26,
    backgroundColor: "#B6BECB",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  mediaPreview: StyleSheet.absoluteFillObject,
  mediaPickerHint: { position: "absolute", alignSelf: "center", top: "45%", fontFamily: fonts.bodyMedium, color: "rgba(23,20,18,0.6)" },
  mediaTagsRow: { flexDirection: "row", gap: 8, padding: 14 },
  mediaTag: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.ink, backgroundColor: "rgba(255,253,250,0.92)", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  captionCard: { marginBottom: 14, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 22, padding: 16 },
  captionInput: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, minHeight: 44 },
  captionFooter: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  hashtag: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.accent, backgroundColor: colors.accentTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  hashtagHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint },
  charCount: { fontFamily: fonts.body, fontSize: 11, color: colors.inkFaint },
  optionsCard: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.hairline, borderRadius: 22, overflow: "hidden" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15 },
  optionDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  optionLabel: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  optionValue: { fontFamily: fonts.body, fontSize: 13, color: colors.inkFaint },
  optionInlineInput: { fontFamily: fonts.body, fontSize: 13, color: colors.inkFaint, textAlign: "right" },
  error: { color: colors.cheer, marginTop: 14, textAlign: "center" },
});
