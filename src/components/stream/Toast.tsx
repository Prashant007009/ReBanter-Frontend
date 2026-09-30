import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { stream, fonts } from "@/theme/colors";
import { PopIn } from "@/components/chat/MessageBubble";

const ToastContext = createContext<(message: string) => void>(() => {});

/** App-wide confirmation pill ("Saved to your collection", "Link copied", …) above the tab bar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [key, setKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    setKey((k) => k + 1);
    timer.current = setTimeout(() => setMessage(""), 1900);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <View pointerEvents="none" style={styles.wrap}>
          <PopIn key={key}>
            <Text style={styles.toast}>{message}</Text>
          </PopIn>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 108, zIndex: 120, alignItems: "center" },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: stream.ink,
    color: stream.bg,
    fontFamily: fonts.bodySemibold,
    fontSize: 13.5,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
});
