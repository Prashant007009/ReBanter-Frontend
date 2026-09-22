import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { ChevronLeftIcon } from "@/assets/icons";

export function ImageViewerModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <ChevronLeftIcon size={24} color="#fff" strokeWidth={2} />
        </Pressable>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,9,8,0.95)", alignItems: "center", justifyContent: "center" },
  closeButton: { position: "absolute", top: 56, left: 18, zIndex: 1, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "80%" },
});
