import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { stream, fonts } from "@/theme/colors";

/** Dark slide-up sheet with a grabber and optional centered title (comments, share, create). */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  fill = false,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Take up to 78% of the screen even when content is short (lists). */
  fill?: boolean;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    rise.setValue(0);
    Animated.timing(rise, { toValue: 1, duration: 280, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [visible, rise]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          style={[
            styles.sheet,
            fill && styles.sheetFill,
            { transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
          ]}
        >
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    maxHeight: "78%",
    backgroundColor: stream.sheet,
    borderTopWidth: 1,
    borderColor: stream.sheetBorder,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 28,
  },
  sheetFill: { height: "78%" },
  grabberRow: { alignItems: "center", paddingTop: 9, paddingBottom: 4 },
  grabber: { width: 38, height: 4, borderRadius: 4, backgroundColor: "#3A3A42" },
  title: { textAlign: "center", paddingTop: 6, paddingBottom: 14, fontFamily: fonts.display, fontSize: 16, color: stream.ink },
});
