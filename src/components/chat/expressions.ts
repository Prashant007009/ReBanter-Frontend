// Emoji / GIF / sticker catalog for the chat expression tray (source: claude.ai
// design "Rebanter Chat"). GIFs and text stickers are app-drawn cards, so they
// travel as `kind: "sticker"` messages with a tagged body — `gif:<id>` or
// `tag:<id>` — while emoji stickers keep the bare emoji as their body.
import type { Message } from "@/api/types";

const GRAPHEME = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*|[\s\S]/gu;

/** Split a string into user-visible characters (emoji ZWJ sequences stay whole). */
export function graphemes(s: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment);
  return s.match(GRAPHEME) ?? [];
}

/** 1–3 emoji and nothing else — rendered large with no bubble. */
export function isBigEmoji(text: string | null): boolean {
  if (!text) return false;
  const g = graphemes(text.trim());
  return g.length > 0 && g.length <= 3 && g.every((x) => /\p{Extended_Pictographic}/u.test(x));
}

export const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];
export const DEFAULT_RECENTS = graphemes("😂❤️🔥😭🙏✨👀💀🥹😅🤝💯");

export const EMOJI_CATS = [
  { id: "recent", icon: "🕘", name: "Recently used", s: "" },
  { id: "smileys", icon: "😀", name: "Smileys", s: "😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬😮‍💨😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕😟🙁😮😯😲😳🥺🥹😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈💀☠️💩🤡👻👽🤖🫠🫡" },
  { id: "people", icon: "👋", name: "People & gestures", s: "👋🤚🖐✋🖖👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆👇☝️👍👎✊👊🤛🤜👏🙌🫶👐🤲🤝🙏💪🦾👀👁👅👄💋🧠🫀💅🤳🙋🙅🙆🤷🤦" },
  { id: "hearts", icon: "❤️", name: "Hearts & symbols", s: "❤️🧡💛💚💙💜🖤🤍🤎💔❤️‍🔥💕💞💓💗💖💘💝💟✨⭐🌟💫💥💢💦💨💬💭💤✅❌⚡🎉🎊🎈💯🔥" },
  { id: "animals", icon: "🐻", name: "Animals & nature", s: "🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐔🐧🐦🐤🦆🦅🦉🐺🐴🦄🐝🦋🐌🐞🐢🐍🦖🐙🦀🐠🐬🐳🦈🌵🌸🌻🍀" },
  { id: "food", icon: "🍔", name: "Food & drink", s: "🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍒🍑🥭🍍🥥🥝🍅🥑🍆🌶🌽🥕🍔🍟🍕🌭🥪🌮🌯🍜🍣🍩🍪🎂🍰🧁🍫🍿☕🍵🧋🍺🍻🥂🍷" },
  { id: "activity", icon: "⚽", name: "Activity", s: "⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🥊🎯🎮🕹🎲🧩🎸🎹🥁🎤🎧🎬🎨🏆🥇🎟🛹🏄🚴🏋️" },
  { id: "travel", icon: "✈️", name: "Travel & places", s: "🚗🚕🚙🚌🏎🚓🚑🚒✈️🚀🛸🚁⛵🚤🗽🗼🏰🎡🎢🏖🏝🌋🗻🌅🌄🌃🌉🌌🌈☀️🌙⛈❄️🌊" },
].map((c) => ({ ...c, list: graphemes(c.s) }));

const KEYWORDS: Record<string, string> = {
  laugh: "😂🤣😆😹😅", lol: "😂🤣💀", love: "❤️😍🥰😘💕💖🫶", heart: "❤️🧡💛💚💙💜🖤🤍💔❤️‍🔥", cry: "😭😢🥹",
  sad: "😢😞😔🥺", fire: "🔥❤️‍🔥", dead: "💀☠️", skull: "💀", eyes: "👀", party: "🥳🎉🎊", cool: "😎", angry: "😡😠🤬",
  think: "🤔", pray: "🙏", clap: "👏", ok: "👌👍", yes: "👍✅", no: "👎❌🙅", food: "🍕🍔🍟🌮🍣", cat: "🐱😹", dog: "🐶",
  sleep: "😴💤", wow: "😮😲🤯", shock: "😱😳", money: "🤑", melt: "🫠", "100": "💯",
};

export function searchEmoji(query: string): string[] {
  const q = query.trim().toLowerCase();
  const out = new Set<string>();
  Object.entries(KEYWORDS).forEach(([k, v]) => {
    if (k.includes(q) || q.includes(k)) graphemes(v).forEach((e) => out.add(e));
  });
  return [...out];
}

export type Gif = { id: string; label: string; bg: string; ink: string; h: number; tags: string[] };
export const GIF_CATS = ["Trending", "Reactions", "LOL", "Hype", "Love", "Mood", "Nope"];
export const GIFS: Gif[] = [
  { id: "no-way", label: "NO WAY", bg: "#FF5C39", ink: "#0C0C0E", h: 150, tags: ["Trending", "Reactions"] },
  { id: "lmaooo", label: "lmaooo", bg: "#7B5CFF", ink: "#fff", h: 112, tags: ["Trending", "LOL"] },
  { id: "mic-drop", label: "mic drop", bg: "#1FB7A6", ink: "#0C0C0E", h: 132, tags: ["Trending", "Hype"] },
  { id: "bruh", label: "bruh.", bg: "#F2C94C", ink: "#0C0C0E", h: 168, tags: ["Reactions", "LOL"] },
  { id: "crying", label: "i'm crying", bg: "#FF7AB6", ink: "#0C0C0E", h: 120, tags: ["LOL", "Mood"] },
  { id: "say-less", label: "say less", bg: "#3E7BFA", ink: "#fff", h: 144, tags: ["Trending", "Hype"] },
  { id: "iconic", label: "iconic", bg: "#C8F169", ink: "#0C0C0E", h: 116, tags: ["Hype", "Love"] },
  { id: "nope", label: "nope", bg: "#FF4D4D", ink: "#fff", h: 158, tags: ["Reactions", "Nope"] },
  { id: "slay", label: "slay", bg: "#B36CFF", ink: "#fff", h: 126, tags: ["Hype", "Love"] },
  { id: "ok", label: "…ok", bg: "#34343B", ink: "#F5F3EF", h: 138, tags: ["Mood", "Nope"] },
  { id: "w", label: "W", bg: "#FFB020", ink: "#0C0C0E", h: 110, tags: ["Hype", "Trending"] },
  { id: "miss-u", label: "miss u", bg: "#FF8FA3", ink: "#0C0C0E", h: 150, tags: ["Love", "Mood"] },
  { id: "side-eye", label: "side eye", bg: "#5B6CFF", ink: "#fff", h: 124, tags: ["Reactions", "Mood"] },
  { id: "not-me", label: "not me", bg: "#20C997", ink: "#0C0C0E", h: 146, tags: ["LOL", "Nope"] },
];

export type TextSticker = { id: string; text: string; bg: string; ink: string; rot: number };
export type StickerItem = { kind: "emoji"; emoji: string } | ({ kind: "text" } & TextSticker);
export type StickerPack = { name: string; thumb: string; items: StickerItem[] };

const TEXT_STICKERS: TextSticker[] = [
  { id: "no-cap", text: "no cap", bg: "#C8F169", ink: "#0C0C0E", rot: -4 },
  { id: "bruh", text: "bruh", bg: "#FF5C39", ink: "#0C0C0E", rot: 3 },
  { id: "say-less", text: "say less", bg: "#7B5CFF", ink: "#fff", rot: -2 },
  { id: "w", text: "W", bg: "#FFB020", ink: "#0C0C0E", rot: 5 },
  { id: "l", text: "L", bg: "#34343B", ink: "#F5F3EF", rot: -6 },
  { id: "ate", text: "ate.", bg: "#FF7AB6", ink: "#0C0C0E", rot: 2 },
  { id: "rent-free", text: "rent free", bg: "#1FB7A6", ink: "#0C0C0E", rot: -3 },
  { id: "its-giving", text: "it's giving", bg: "#3E7BFA", ink: "#fff", rot: 4 },
  { id: "period", text: "period.", bg: "#F2C94C", ink: "#0C0C0E", rot: -2 },
];

const emojiPack = (s: string): StickerItem[] => graphemes(s).map((emoji) => ({ kind: "emoji", emoji }));
export const STICKER_PACKS: StickerPack[] = [
  { name: "Rebanter Originals", thumb: "Aa", items: TEXT_STICKERS.map((t) => ({ kind: "text", ...t })) },
  { name: "Big Mood", thumb: "🫠", items: emojiPack("🥹😭💀😤🫠🤡😎🥳🙄😴🤯🫡") },
  { name: "Soft Hours", thumb: "🫶", items: emojiPack("😍🥰💘💞🫶😘💌🌹🧸✨💐🍓") },
  { name: "Chaos Pets", thumb: "🐸", items: emojiPack("🐸🐶🐱🦆🐧🦝🐹🐼🦖🐙🐝🦄") },
];

export const gifBody = (g: Gif) => `gif:${g.id}`;
export const stickerBody = (s: StickerItem) => (s.kind === "emoji" ? s.emoji : `tag:${s.id}`);

export type StickerContent = { kind: "gif"; gif: Gif } | { kind: "text"; sticker: TextSticker } | { kind: "emoji"; emoji: string };

/** Decode a sticker message body back into what to draw. */
export function decodeSticker(body: string | null): StickerContent {
  const raw = body ?? "";
  if (raw.startsWith("gif:")) {
    const gif = GIFS.find((g) => g.id === raw.slice(4));
    if (gif) return { kind: "gif", gif };
  }
  if (raw.startsWith("tag:")) {
    const sticker = TEXT_STICKERS.find((t) => t.id === raw.slice(4));
    if (sticker) return { kind: "text", sticker };
  }
  return { kind: "emoji", emoji: raw };
}

/** One-line summary of a message for conversation lists. */
export function messagePreview(m: Message): string {
  if (m.undecryptable) return "🔒 Encrypted message";
  if (m.kind === "image") return "Sent a photo";
  if (m.kind === "sticker") {
    const s = decodeSticker(m.body);
    return s.kind === "gif" ? "Sent a GIF" : s.kind === "text" ? `Sent a sticker: ${s.sticker.text}` : s.emoji;
  }
  return m.body ?? "Sent a drop";
}
