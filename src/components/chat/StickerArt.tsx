import { StyleSheet, Text } from "react-native";
import { fonts } from "@/theme/colors";
import type { TextSticker } from "./expressions";

/** Die-cut word sticker: tilted color slab with a white border and a hard drop shadow. */
export function WordSticker({ sticker, size = "large" }: { sticker: TextSticker; size?: "large" | "small" }) {
  const small = size === "small";
  return (
    <Text
      style={[
        styles.word,
        small ? styles.wordSmall : styles.wordLarge,
        { backgroundColor: sticker.bg, color: sticker.ink, transform: [{ rotate: `${sticker.rot}deg` }] },
      ]}
      numberOfLines={1}
    >
      {sticker.text}
    </Text>
  );
}

/** Emoji drawn big with a white halo, so it reads as a sticker rather than a character. */
export function EmojiSticker({ emoji, size = 84 }: { emoji: string; size?: number }) {
  return <Text style={[styles.emoji, { fontSize: size, lineHeight: size * 1.12 }]}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  word: {
    fontFamily: fonts.display,
    letterSpacing: -0.5,
    borderColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 4,
  },
  wordLarge: { fontSize: 30, lineHeight: 32, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 3, borderRadius: 14, margin: 10, shadowOffset: { width: 0, height: 6 } },
  wordSmall: { fontSize: 17, lineHeight: 19, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 2.5, borderRadius: 10, shadowOffset: { width: 0, height: 4 } },
  emoji: {
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 10,
    padding: 4,
  },
});
