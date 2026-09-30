import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { chat, fonts } from "@/theme/colors";
import { GifCard } from "./GifCard";
import { EmojiSticker, WordSticker } from "./StickerArt";
import { BackspaceIcon, SearchThinIcon } from "./ChatIcons";
import { EMOJI_CATS, GIFS, GIF_CATS, STICKER_PACKS, searchEmoji, type Gif, type StickerItem } from "./expressions";

export type TrayTab = "emoji" | "gif" | "stickers";
export const TRAY_HEIGHT = 318;

const TABS: [TrayTab, string][] = [
  ["emoji", "Emoji"],
  ["gif", "GIFs"],
  ["stickers", "Stickers"],
];
const SEARCH_PLACEHOLDER: Record<TrayTab, string> = { emoji: "Search emoji", gif: "Search GIFs", stickers: "Search stickers" };

/** Keyboard-height panel under the composer: emoji picker, GIF masonry and sticker packs. */
export function ExpressionTray({
  tab,
  onTabChange,
  recents,
  reacting,
  onCancelReact,
  onPickEmoji,
  onSendGif,
  onSendSticker,
  onBackspace,
}: {
  tab: TrayTab;
  onTabChange: (tab: TrayTab) => void;
  recents: string[];
  /** Picking an emoji reacts to a message instead of typing it. */
  reacting: boolean;
  onCancelReact: () => void;
  onPickEmoji: (emoji: string) => void;
  onSendGif: (gif: Gif) => void;
  onSendSticker: (item: StickerItem) => void;
  onBackspace: () => void;
}) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("recent");
  const [gifCat, setGifCat] = useState("Trending");
  const [pack, setPack] = useState(0);
  const q = search.trim().toLowerCase();

  const emoji = useMemo(() => {
    if (q) return { title: `Results for “${search.trim()}”`, list: searchEmoji(q) };
    const c = EMOJI_CATS.find((x) => x.id === cat)!;
    return { title: c.name, list: c.id === "recent" ? recents : c.list };
  }, [q, search, cat, recents]);

  const gifs = GIFS.filter((g) => (q ? g.label.toLowerCase().includes(q) || g.tags.some((t) => t.toLowerCase().includes(q)) : g.tags.includes(gifCat)));
  const stickers = STICKER_PACKS[pack].items.filter((it) => !q || (it.kind === "text" && it.text.toLowerCase().includes(q)));

  function switchTab(next: TrayTab) {
    setSearch("");
    onTabChange(next);
  }

  return (
    <View style={styles.tray}>
      <View style={styles.grabberRow}>
        <View style={styles.grabber} />
      </View>
      {reacting ? (
        <View style={styles.reactingRow}>
          <Text style={styles.reactingText}>Pick any emoji to react</Text>
          <Pressable onPress={onCancelReact} hitSlop={8}>
            <Text style={styles.reactingCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.search}>
        <SearchThinIcon />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={SEARCH_PLACEHOLDER[tab]}
          placeholderTextColor={chat.inkMuted}
          style={styles.searchInput}
        />
      </View>

      {tab === "emoji" ? (
        <View style={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
            {EMOJI_CATS.map((c) => {
              const active = !q && cat === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setCat(c.id);
                    setSearch("");
                  }}
                  style={[styles.catButton, active && { backgroundColor: chat.chipActive }, { opacity: active ? 1 : 0.6 }]}
                >
                  <Text style={styles.catIcon}>{c.icon}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView style={styles.body} contentContainerStyle={styles.emojiScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>{emoji.title}</Text>
            {emoji.list.length === 0 ? <Text style={styles.empty}>No emoji match that</Text> : null}
            <View style={styles.emojiGrid}>
              {emoji.list.map((e) => (
                <Pressable key={e} onPress={() => onPickEmoji(e)} style={({ pressed }) => [styles.emojiCell, pressed && { backgroundColor: chat.chip }]}>
                  <Text style={styles.emojiGlyph}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {tab === "gif" ? (
        <View style={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={[styles.stripContent, styles.gifChips]}>
            {GIF_CATS.map((g) => {
              const active = !q && gifCat === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => {
                    setGifCat(g);
                    setSearch("");
                  }}
                  style={[styles.gifChip, { backgroundColor: active ? chat.bubbleMine : chat.chip }]}
                >
                  <Text style={[styles.gifChipText, { color: active ? chat.onMine : "#D6D4DB" }]}>{g}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView style={styles.body} contentContainerStyle={styles.masonry} showsVerticalScrollIndicator={false}>
            {[0, 1].map((col) => (
              <View key={col} style={styles.masonryCol}>
                {gifs
                  .filter((_, i) => i % 2 === col)
                  .map((g) => (
                    <Pressable key={g.id} onPress={() => onSendGif(g)}>
                      <GifCard gif={g} height={g.h} radius={14} fontSize={24} showTag={false} delay={col * 600} />
                    </Pressable>
                  ))}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {tab === "stickers" ? (
        <View style={styles.body}>
          <View style={styles.packRow}>
            {STICKER_PACKS.map((pk, i) => (
              <Pressable key={pk.name} onPress={() => setPack(i)} style={[styles.packButton, { borderColor: pack === i ? chat.bubbleMine : "transparent" }]}>
                <Text style={styles.packThumb}>{pk.thumb}</Text>
              </Pressable>
            ))}
            <Text style={styles.packName}>{STICKER_PACKS[pack].name}</Text>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.stickerGrid} showsVerticalScrollIndicator={false}>
            {stickers.map((it) => (
              <Pressable
                key={it.kind === "emoji" ? it.emoji : it.id}
                onPress={() => onSendSticker(it)}
                style={({ pressed }) => [styles.stickerCell, pressed && { backgroundColor: "#1E1E23" }]}
              >
                {it.kind === "emoji" ? <EmojiSticker emoji={it.emoji} size={50} /> : <WordSticker sticker={it} size="small" />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerSide} />
        <View style={styles.segment}>
          {TABS.map(([id, label]) => (
            <Pressable key={id} onPress={() => switchTab(id)} style={[styles.segmentButton, tab === id && { backgroundColor: chat.ink }]}>
              <Text style={[styles.segmentText, { color: tab === id ? chat.onMine : chat.inkSoft }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onBackspace} disabled={tab !== "emoji"} style={[styles.footerSide, styles.backspace, { opacity: tab === "emoji" ? 1 : 0 }]}>
          <BackspaceIcon />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { height: TRAY_HEIGHT, backgroundColor: chat.tray, borderTopWidth: 1, borderTopColor: chat.trayBorder },
  grabberRow: { alignItems: "center", paddingTop: 7, paddingBottom: 5 },
  grabber: { width: 36, height: 4, borderRadius: 4, backgroundColor: "#3A3A42" },
  reactingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 14, marginBottom: 6 },
  reactingText: { fontFamily: fonts.body, fontSize: 12.5, color: chat.inkMuted },
  reactingCancel: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: chat.bubbleMine },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 36, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 12, backgroundColor: chat.chip, borderRadius: 12 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14, color: chat.ink, paddingVertical: 0 },
  body: { flex: 1, minHeight: 0 },
  strip: { flexGrow: 0, flexShrink: 0 },
  stripContent: { gap: 2, paddingHorizontal: 10, paddingBottom: 4 },
  catButton: { width: 38, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catIcon: { fontSize: 18 },
  emojiScroll: { paddingHorizontal: 8, paddingBottom: 8 },
  sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 11.5, letterSpacing: 0.5, textTransform: "uppercase", color: chat.inkMuted, paddingHorizontal: 6, paddingTop: 8, paddingBottom: 4 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: chat.inkMuted, textAlign: "center", padding: 24 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap" },
  emojiCell: { width: "12.5%", height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emojiGlyph: { fontSize: 28 },
  gifChips: { gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  gifChip: { height: 30, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" },
  gifChipText: { fontFamily: fonts.bodySemibold, fontSize: 12.5 },
  masonry: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingBottom: 8, alignItems: "flex-start" },
  masonryCol: { flex: 1, gap: 6 },
  packRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingBottom: 4 },
  packButton: { width: 40, height: 40, borderWidth: 2, borderRadius: 12, backgroundColor: chat.chip, alignItems: "center", justifyContent: "center" },
  packThumb: { fontFamily: fonts.display, fontSize: 17, color: chat.ink },
  packName: { marginLeft: 6, fontFamily: fonts.bodySemibold, fontSize: 12.5, color: chat.inkMuted },
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, paddingTop: 4, paddingBottom: 8 },
  stickerCell: { width: "33.333%", height: 92, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4, borderTopWidth: 1, borderTopColor: "#1F1F24" },
  footerSide: { width: 40 },
  backspace: { height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", gap: 2, padding: 3, backgroundColor: "#1E1E23", borderRadius: 999 },
  segmentButton: { height: 30, paddingHorizontal: 15, borderRadius: 999, justifyContent: "center" },
  segmentText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
});
