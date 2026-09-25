import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { stream, fonts } from "@/theme/colors";
import { BottomSheet } from "@/components/stream/BottomSheet";

/** What a Rebanter code points at. */
export type ScanTarget = { kind: "user"; handle: string } | { kind: "drop"; dropId: string };

export function profileCode(handle: string) {
  return `rebanter://u/${handle}`;
}

/** Accepts rebanter://u/<handle>, rebanter.app/u/<handle> and drop links (…/d/<id>). */
export function parseCode(data: string): ScanTarget | null {
  const m = data.trim().match(/^(?:rebanter:\/\/|https?:\/\/(?:www\.)?rebanter\.app\/)(u|d)\/([A-Za-z0-9._-]+)/);
  if (!m) {
    // Profile links shown on Me: https://rebanter.app/<handle>
    const p = data.trim().match(/^https?:\/\/(?:www\.)?rebanter\.app\/([a-z0-9._]{3,24})\/?$/i);
    return p ? { kind: "user", handle: p[1] } : null;
  }
  return m[1] === "u" ? { kind: "user", handle: m[2] } : { kind: "drop", dropId: m[2] };
}

/**
 * Roam's scan button: show your own Rebanter code for someone to scan, or
 * flip to the camera and scan theirs.
 */
export function ScanSheet({
  visible,
  handle,
  onClose,
  onScanned,
}: {
  visible: boolean;
  handle: string;
  onClose: () => void;
  onScanned: (target: ScanTarget) => void;
}) {
  const [mode, setMode] = useState<"code" | "scan">("code");
  const [permission, requestPermission] = useCameraPermissions();
  const [hint, setHint] = useState<string | null>(null);

  function close() {
    setMode("code");
    setHint(null);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={close} title={mode === "code" ? "Your Rebanter code" : "Scan a Rebanter code"}>
      <View style={styles.body}>
        {mode === "code" ? (
          <>
            <View style={styles.codeCard}>
              <QRCode value={profileCode(handle)} size={196} color={stream.onLime} backgroundColor={stream.lime} />
            </View>
            <Text style={styles.handle}>@{handle}</Text>
            <Text style={styles.note}>Friends scan this to open your profile and add you to their crew.</Text>
          </>
        ) : permission?.granted ? (
          <>
            <View style={styles.cameraFrame}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  const target = parseCode(data);
                  if (target) {
                    close();
                    onScanned(target);
                  } else setHint("That's not a Rebanter code");
                }}
              />
              <View style={styles.reticle} pointerEvents="none" />
            </View>
            <Text style={styles.note}>{hint ?? "Point the camera at someone's Rebanter code."}</Text>
          </>
        ) : (
          <View style={styles.permission}>
            <Text style={styles.note}>
              {permission && !permission.canAskAgain
                ? "Camera access is off for ReBanter — turn it on in Settings to scan codes."
                : Platform.OS === "web"
                  ? "Allow camera access in your browser to scan a code."
                  : "ReBanter needs the camera to scan codes."}
            </Text>
            {!permission || permission.canAskAgain ? (
              <Pressable style={styles.allow} onPress={requestPermission}>
                <Text style={styles.allowText}>Allow camera</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.segment}>
          {(["code", "scan"] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.segmentButton, mode === m && { backgroundColor: stream.ink }]}>
              <Text style={[styles.segmentText, { color: mode === m ? stream.bg : stream.inkSoft }]}>{m === "code" ? "My code" : "Scan"}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", gap: 14, paddingHorizontal: 24, paddingBottom: 4 },
  codeCard: { padding: 18, borderRadius: 28, backgroundColor: stream.lime },
  handle: { fontFamily: fonts.display, fontSize: 20, color: stream.ink },
  note: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: stream.inkMuted, textAlign: "center" },
  cameraFrame: { width: 250, height: 250, borderRadius: 28, overflow: "hidden", backgroundColor: "#000" },
  reticle: { position: "absolute", left: 40, top: 40, right: 40, bottom: 40, borderRadius: 20, borderWidth: 3, borderColor: stream.lime },
  permission: { width: 250, height: 250, borderRadius: 28, backgroundColor: stream.raised, alignItems: "center", justifyContent: "center", gap: 14, padding: 20 },
  allow: { height: 40, paddingHorizontal: 18, borderRadius: 14, backgroundColor: stream.lime, justifyContent: "center" },
  allowText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: stream.onLime },
  segment: { flexDirection: "row", gap: 2, padding: 3, borderRadius: 999, backgroundColor: "#1E1E23", marginTop: 4 },
  segmentButton: { height: 32, paddingHorizontal: 18, borderRadius: 999, justifyContent: "center" },
  segmentText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
});
