import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { ScreenGradient } from "@/components/ScreenGradient";
import { ChevronLeftIcon, CameraIcon } from "@/assets/icons";
import { useSession } from "@/session/SessionContext";
import { updateMe } from "@/api/users";
import { uploadLocalAsset } from "@/api/media";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

export function EditProfileScreen({ navigation }: Props) {
  const { user, refreshMe } = useSession();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [link, setLink] = useState(user?.link ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function onChangeAvatar() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to change your avatar");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setIsUploadingAvatar(true);
    try {
      const url = await uploadLocalAsset(asset.uri, asset.mimeType || "image/jpeg");
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function onSave() {
    setError(null);
    setIsSaving(true);
    try {
      await updateMe({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        link: link.trim() || null,
        avatarUrl,
      });
      await refreshMe();
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScreenGradient style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <ChevronLeftIcon size={22} color={colors.onDark} />
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <Pressable onPress={onSave} disabled={isSaving || !displayName.trim()}>
          {isSaving ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.save}>Save</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.avatarWrap} onPress={onChangeAvatar} disabled={isUploadingAvatar}>
        <Avatar handle={user.handle} displayName={displayName || user.displayName} avatarUrl={avatarUrl} size={92} radius={30} />
        <View style={styles.avatarBadge}>
          {isUploadingAvatar ? <ActivityIndicator size="small" color={colors.ink} /> : <CameraIcon size={16} color={colors.ink} strokeWidth={2} />}
        </View>
      </Pressable>
      <Text style={styles.avatarHint}>Tap to change photo</Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={colors.inkFaint} />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={bio}
        onChangeText={setBio}
        placeholder="Interface design, long walks, short opinions."
        placeholderTextColor={colors.inkFaint}
        multiline
        maxLength={280}
      />

      <Text style={styles.label}>Link</Text>
      <TextInput style={styles.input} value={link} onChangeText={setLink} placeholder="rebanter.app/you" placeholderTextColor={colors.inkFaint} autoCapitalize="none" />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.onDark },
  save: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
  avatarWrap: { alignSelf: "center", position: "relative" },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { textAlign: "center", fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accent, marginTop: 10, marginBottom: 26 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.onDarkMuted, marginBottom: 8 },
  input: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 15,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 18,
  },
  multiline: { height: 90, paddingTop: 13, textAlignVertical: "top" },
  error: { color: colors.cheer, textAlign: "center", marginTop: 6 },
});
