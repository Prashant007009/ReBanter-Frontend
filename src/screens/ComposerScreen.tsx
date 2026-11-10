import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setStatusBarStyle } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { captureRef } from "react-native-view-shot";
import dayjs from "@/lib/dayjs";
import { stream, fonts } from "@/theme/colors";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/stream/Toast";
import { CloseGlyph } from "@/components/stream/StreamIcons";
import { ZapGlyph } from "@/components/me/DropViewer";
import { Slider } from "@/components/compose/Slider";
import { PickerSheet, type PickerRow } from "@/components/compose/PickerSheet";
import { COLLAGE_LAYOUTS, CollageCanvas, FRAME_COLORS, LayoutThumb } from "@/components/compose/Collage";
import { LoopVideo } from "@/components/loops/LoopVideo";
import { useSession } from "@/session/SessionContext";
import { getItem, setItem, deleteItem } from "@/session/tokenStore";
import { uploadLocalAsset } from "@/api/media";
import { createDrop, type DropOptions } from "@/api/drops";
import { createMoment } from "@/api/moments";
import { createLoop, getCloseCircle, getPlaces, getSounds, setCloseCircle, type PickerItem } from "@/api/compose";
import { getMyCrew } from "@/api/crew";
import { getTrending } from "@/api/roam";
import type { UserSummary } from "@/api/types";
import type { RootStackParamList } from "@/navigation/types";

type Mode = "photo" | "loop" | "collage" | "moment" | "take" | "poll";
const MODES: [Mode, string, string, string][] = [
  ["photo", "📸", "Photo", "drop"],
  ["loop", "🎬", "Loop", "loop"],
  ["collage", "🧩", "Collage", "collage"],
  ["moment", "⚡", "Moment", "moment"],
  ["take", "🔥", "Hot take", "hot take"],
  ["poll", "📊", "Poll", "poll"],
];
const RATIOS = [
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["16:9", 16 / 9],
] as const;
const TAKE_COLORS = ["#7B5CFF", "#C8F169", "#FF5C39", "#FFB020", "#F5F3EF"];
const TAKE_INK: Record<string, string> = { "#7B5CFF": "#FFFFFF" };
const OVERLAYS = [
  ["#C8F169", "#0C0C0E"],
  ["#0C0C0E", "#F5F3EF"],
  ["#FF7AB6", "#0C0C0E"],
] as const;
const LENGTHS = [15, 30, 60, 90];
const SPEEDS = [0.5, 1, 2, 3] as const;
const EFFECTS = ["Green screen", "Voiceover", "Captions", "Countdown"];
const POLL_DURATIONS = [
  ["1h", 1],
  ["24h", 24],
  ["3d", 72],
  ["7d", 168],
] as const;
const AUDIENCES = [
  ["everyone", "🌍", "Everyone"],
  ["crew", "👥", "Crew"],
  ["close", "💚", "Close circle"],
] as const;

type Draft = {
  mode: Mode;
  caption: string;
  photos: string[];
  ratio: number;
  take: string;
  takeColor: number;
  pollQ: string;
  opts: string[];
  pollDur: number;
  overlay: string;
  overlayColor: number;
  layout: number;
  gap: number;
  frame: number;
  place: string | null;
  sound: string | null;
  alsoLoop: boolean;
  schedule: boolean;
  slot: number;
  audience: "everyone" | "crew" | "close";
  commentsOff: boolean;
  hideCounts: boolean;
  allowRemix: boolean;
  alt: string;
};

const blank = (mode: Mode): Draft => ({
  mode,
  caption: "",
  photos: [],
  ratio: 1,
  take: "",
  takeColor: 0,
  pollQ: "",
  opts: ["", ""],
  pollDur: 1,
  overlay: "",
  overlayColor: 0,
  layout: 0,
  gap: 4,
  frame: 0,
  place: null,
  sound: null,
  alsoLoop: false,
  schedule: false,
  slot: 0,
  audience: "everyone",
  commentsOff: false,
  hideCounts: false,
  allowRemix: true,
  alt: "",
});

/** Next 5 sensible publish slots (9:00, 12:30, 18:00, 20:00), starting 30 minutes from now. */
function scheduleSlots() {
  const out: Date[] = [];
  const earliest = Date.now() + 30 * 60_000;
  for (let d = 0; out.length < 5 && d < 7; d++) {
    for (const [h, m] of [
      [9, 0],
      [12, 30],
      [18, 0],
      [20, 0],
    ]) {
      const t = dayjs().add(d, "day").hour(h).minute(m).second(0).millisecond(0).toDate();
      if (t.getTime() > earliest) out.push(t);
      if (out.length === 5) break;
    }
  }
  return out;
}
const slotDay = (t: Date) => (dayjs(t).isSame(dayjs(), "day") ? "Today" : dayjs(t).isSame(dayjs().add(1, "day"), "day") ? "Tmrw" : dayjs(t).format("ddd"));

type Props = NativeStackScreenProps<RootStackParamList, "NewDrop" | "NewMoment" | "NewTake">;

/** The Drop composer (Rebanter Drop design): photo, loop, collage, moment, hot take or poll. */
export function ComposerScreen({ navigation, route }: Props) {
  const { user } = useSession();
  const toast = useToast();
  const params = (route.params ?? {}) as { mode?: Mode; remix?: { kind: "take" | "poll"; body: string; options?: string[]; author: string } };
  const initialMode: Mode = route.name === "NewMoment" ? "moment" : params.mode ?? "photo";
  const [d, setD] = useState<Draft>(() => {
    const b = blank(initialMode);
    if (params.remix?.kind === "take") return { ...b, take: params.remix.body };
    if (params.remix?.kind === "poll") return { ...b, pollQ: params.remix.body, opts: params.remix.options?.length ? params.remix.options : ["", ""] };
    return b;
  });
  const [saved, setSaved] = useState(false);
  const [cur, setCur] = useState(0);
  const [captionFocus, setCaptionFocus] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [sheet, setSheet] = useState<"place" | "crew" | "sound" | "close" | null>(null);
  const [q, setQ] = useState("");
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [crew, setCrew] = useState<UserSummary[]>([]);
  const [tagged, setTagged] = useState<Record<string, boolean>>({});
  const [circle, setCircle] = useState<Record<string, boolean>>({});
  const [trending, setTrending] = useState<string[]>([]);
  const [collageImgs, setCollageImgs] = useState<(string | null)[]>([]);
  const [video, setVideo] = useState<{ uri: string; mime: string; durationSec: number } | null>(null);
  const [loopLen, setLoopLen] = useState(30);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [trimEnd, setTrimEnd] = useState(70);
  const [effects, setEffects] = useState<Record<string, boolean>>({});
  const [momentPhoto, setMomentPhoto] = useState<string | null>(null);
  const [pub, setPub] = useState<null | "busy" | "done">(null);
  const [pubP, setPubP] = useState(0);
  const [pubInfo, setPubInfo] = useState("");
  const collageRef = useRef<View>(null);
  const slots = useMemo(scheduleSlots, []);
  const draftKey = user ? `rebanter.dropDraft.${user.id}` : null;

  const upd = useCallback((patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    setSaved(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, [])
  );

  // Crew + trending tags for suggestions; restore a saved draft (not for remixes).
  useEffect(() => {
    getMyCrew()
      .then(setCrew)
      .catch(() => {});
    getTrending()
      .then((r) => setTrending(r.items.map((t) => `#${t.tag}`)))
      .catch(() => {});
    getCloseCircle()
      .then((r) => setCircle(Object.fromEntries(r.items.map((u) => [u.id, true]))))
      .catch(() => {});
    if (!draftKey || params.remix) return;
    getItem(draftKey)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as { draft: Draft; tagged: Record<string, boolean> };
        setD({ ...blank(initialMode), ...saved.draft, mode: route.params ? initialMode : saved.draft.mode });
        setTagged(saved.tagged ?? {});
        setSaved(true);
        toast("Draft restored");
      })
      .catch(() => {});
  }, [draftKey]); // eslint-disable-line

  // Place / sound suggestions follow the search box.
  useEffect(() => {
    if (sheet !== "place" && sheet !== "sound") return;
    const t = setTimeout(() => {
      (sheet === "place" ? getPlaces(q) : getSounds(q))
        .then((r) => setPickerItems(r.items))
        .catch(() => setPickerItems([]));
    }, 200);
    return () => clearTimeout(t);
  }, [sheet, q]);

  // ---- derived ------------------------------------------------------------------
  const md = MODES.find((m) => m[0] === d.mode)!;
  const tags = useMemo(() => [...new Set(d.caption.match(/#[\p{L}\p{N}_]+/gu) ?? [])], [d.caption]);
  const suggestions = trending.filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase())).slice(0, 6);
  const taggedCrew = crew.filter((c) => tagged[c.id]);
  const layout = COLLAGE_LAYOUTS[d.layout];
  const filledCells = collageImgs.slice(0, layout.areas.length).filter(Boolean).length;
  const clipMax = Math.min(loopLen, video?.durationSec ?? loopLen);
  const trimLen = Math.max(1, Math.round((clipMax * trimEnd) / 100));
  const usesAudience = d.mode === "photo" || d.mode === "collage" || d.mode === "take" || d.mode === "poll";
  const ready =
    d.mode === "photo"
      ? d.photos.length > 0
      : d.mode === "loop"
        ? !!video
        : d.mode === "collage"
          ? filledCells >= 2
          : d.mode === "moment"
            ? !!momentPhoto || d.overlay.trim().length > 0
            : d.mode === "take"
              ? d.take.trim().length > 3
              : d.pollQ.trim().length > 0 && d.opts.filter((o) => o.trim()).length >= 2;
  const notReadyHint =
    d.mode === "photo"
      ? "Add at least one photo"
      : d.mode === "loop"
        ? "Pick a video for your loop"
        : d.mode === "collage"
          ? "Fill at least 2 collage cells"
          : d.mode === "moment"
            ? "Add a photo or a text sticker"
            : d.mode === "take"
              ? "Write your take first"
              : "Add a question and 2 options";
  const scheduling = d.schedule && usesAudience;

  // ---- media pickers -------------------------------------------------------------
  async function pickImages(limit: number) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast("Photo access is needed");
      return [];
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      orderedSelection: true,
    });
    return res.canceled ? [] : res.assets.map((a) => a.uri).slice(0, limit);
  }

  async function addPhotos() {
    const uris = await pickImages(10 - d.photos.length);
    if (uris.length) {
      upd({ photos: [...d.photos, ...uris] });
      setCur(d.photos.length);
    }
  }

  async function pickVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast("Photo access is needed");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
    if (res.canceled) return;
    const a = res.assets[0];
    const durationSec = a.duration ? Math.round(a.duration / 1000) : 30;
    setVideo({ uri: a.uri, mime: a.mimeType ?? "video/mp4", durationSec: Math.max(1, durationSec) });
    setSaved(false);
  }

  // ---- publish ---------------------------------------------------------------------
  const captionWithCrew = () => {
    const mentions = taggedCrew.map((c) => `@${c.handle}`).filter((m) => !d.caption.includes(m));
    return [d.caption.trim(), ...mentions].filter(Boolean).join(" ") || undefined;
  };
  const options = (): DropOptions => ({
    soundLabel: d.sound ?? undefined,
    altText: d.alt.trim() || undefined,
    publishAt: scheduling ? slots[d.slot].toISOString() : undefined,
    audience: d.audience,
    commentsOff: d.commentsOff,
    hideCounts: d.hideCounts,
    allowRemix: d.allowRemix,
  });

  async function publish() {
    if (!ready) {
      toast(notReadyHint);
      return;
    }
    setPub("busy");
    setPubP(0.05);
    const tick = (p: number) => setPubP((x) => Math.max(x, p));
    try {
      let info = "";
      if (d.mode === "photo") {
        const urls: string[] = [];
        for (let i = 0; i < d.photos.length; i++) {
          urls.push(await uploadLocalAsset(d.photos[i], "image/jpeg"));
          tick(0.1 + (0.75 * (i + 1)) / d.photos.length);
        }
        await createDrop({
          kind: "post",
          caption: captionWithCrew(),
          location: d.place ?? undefined,
          aspect: RATIOS[d.ratio][0],
          alsoLoop: d.alsoLoop,
          media: urls.map((url) => ({ url, kind: "image" })),
          ...options(),
        });
        info = d.alsoLoop ? " · also shared as a Loop" : "";
      } else if (d.mode === "collage") {
        const uri = await captureRef(collageRef, { format: "jpg", quality: 0.9, result: Platform.OS === "web" ? "data-uri" : "tmpfile" });
        tick(0.35);
        const url = await uploadLocalAsset(uri, "image/jpeg");
        tick(0.8);
        await createDrop({ kind: "post", caption: captionWithCrew(), location: d.place ?? undefined, aspect: "1:1", alsoLoop: d.alsoLoop, media: [{ url, kind: "image" }], ...options() });
      } else if (d.mode === "loop") {
        const videoUrl = await uploadLocalAsset(video!.uri, video!.mime);
        tick(0.8);
        await createLoop({
          videoUrl,
          caption: captionWithCrew(),
          durationSec: Math.max(1, Math.round(trimLen / speed)),
          audioLabel: d.sound ?? undefined,
          playbackRate: speed,
          trimStartSec: 0,
          trimEndSec: trimLen,
          effects: EFFECTS.filter((e) => effects[e]),
        });
      } else if (d.mode === "moment") {
        const mediaUrl = momentPhoto ? await uploadLocalAsset(momentPhoto, "image/jpeg") : undefined;
        tick(0.8);
        const [bg, ink] = OVERLAYS[d.overlayColor];
        await createMoment({ mediaUrl, caption: d.overlay.trim() || undefined, captionBg: d.overlay.trim() ? bg : undefined, captionInk: d.overlay.trim() ? ink : undefined });
      } else if (d.mode === "take") {
        tick(0.6);
        await createDrop({ kind: "take", body: d.take.trim(), takeColor: TAKE_COLORS[d.takeColor], ...options() });
      } else {
        tick(0.6);
        await createDrop({
          kind: "poll",
          body: d.pollQ.trim(),
          options: d.opts.map((o) => o.trim()).filter(Boolean),
          caption: captionWithCrew(),
          durationHours: POLL_DURATIONS[d.pollDur][1],
          ...options(),
        });
      }
      setPubP(1);
      setPubInfo(`${taggedCrew.length ? ` · ${taggedCrew.length} crew tagged` : ""}${info}`);
      setPub("done");
      if (draftKey) deleteItem(draftKey).catch(() => {});
    } catch (err) {
      setPub(null);
      toast(err instanceof Error ? err.message : "Couldn't publish — try again");
    }
  }

  async function saveDraft() {
    if (!draftKey) return;
    await setItem(draftKey, JSON.stringify({ draft: d, tagged })).catch(() => {});
    setSaved(true);
    toast("Draft saved");
  }

  function reset() {
    setD(blank(d.mode));
    setTagged({});
    setCollageImgs([]);
    setVideo(null);
    setMomentPhoto(null);
    setEffects({});
    setCur(0);
    setPub(null);
    setPubP(0);
    setSaved(false);
  }

  function chooseAudience(a: Draft["audience"]) {
    upd({ audience: a });
    if (a === "close" && !Object.values(circle).some(Boolean)) {
      setQ("");
      setSheet("close");
      toast("Pick who's in your close circle");
    }
  }

  // ---- picker rows ---------------------------------------------------------------------
  const lowerQ = q.trim().toLowerCase();
  let pickerTitle = "";
  let pickerRows: PickerRow[] = [];
  let pickerFooter: React.ReactNode = null;
  if (sheet === "place") {
    pickerTitle = "Add place";
    pickerRows = [
      { key: "none", title: "No place", sub: "Hide location", glyph: <Text>📍</Text>, selected: !d.place, onPress: () => { upd({ place: null }); setSheet(null); } },
      ...(q.trim() && !pickerItems.some((p) => p.name.toLowerCase() === lowerQ)
        ? [{ key: "custom", title: q.trim(), sub: "Use this place", glyph: <Text>➕</Text>, selected: false, onPress: () => { upd({ place: q.trim() }); setSheet(null); } }]
        : []),
      ...pickerItems.map((p) => ({ key: p.name, title: p.name, sub: p.sub, glyph: <Text>📍</Text>, selected: d.place === p.name, onPress: () => { upd({ place: p.name }); setSheet(null); } })),
    ];
  } else if (sheet === "sound") {
    pickerTitle = "Add sound";
    pickerRows = [
      ...(q.trim() && !pickerItems.some((p) => p.name.toLowerCase() === lowerQ)
        ? [{ key: "custom", title: q.trim(), sub: "Original sound", glyph: <Text style={styles.noteGlyph}>♪</Text>, glyphBg: stream.lime, selected: false, onPress: () => upd({ sound: q.trim() }) }]
        : []),
      ...pickerItems.map((p, i) => ({
        key: p.name,
        title: p.name,
        sub: p.sub,
        glyph: <Text style={styles.noteGlyph}>♪</Text>,
        glyphBg: ["#7B9CFF", "#C8F169", "#FF7AB6", "#1FB7A6", "#FFB020"][i % 5],
        selected: d.sound === p.name,
        playing: d.sound === p.name,
        onPress: () => upd({ sound: d.sound === p.name ? null : p.name }),
      })),
    ];
    if (pickerRows.length === 0) pickerFooter = <Text style={styles.pickerHint}>Type a name to add an original sound.</Text>;
  } else if (sheet === "crew" || sheet === "close") {
    const isClose = sheet === "close";
    const sel = isClose ? circle : tagged;
    pickerTitle = isClose ? `Close circle · ${Object.values(circle).filter(Boolean).length}` : `Tag crew · ${taggedCrew.length}`;
    pickerRows = crew
      .filter((c) => !lowerQ || c.handle.toLowerCase().includes(lowerQ) || c.displayName.toLowerCase().includes(lowerQ))
      .map((c) => ({
        key: c.id,
        title: c.handle,
        sub: isClose ? (sel[c.id] ? "In your close circle" : "In your crew") : "In your crew",
        glyph: <Avatar handle={c.handle} displayName={c.displayName} avatarUrl={c.avatarUrl} size={42} radius={14} />,
        selected: !!sel[c.id],
        onPress: () => (isClose ? setCircle((x) => ({ ...x, [c.id]: !x[c.id] })) : setTagged((x) => ({ ...x, [c.id]: !x[c.id] }))),
      }));
    if (crew.length === 0) pickerFooter = <Text style={styles.pickerHint}>Your crew shows up here once people join it.</Text>;
  }

  function closeSheet() {
    if (sheet === "close") {
      const ids = Object.entries(circle)
        .filter(([, v]) => v)
        .map(([k]) => k);
      setCloseCircle(ids)
        .then((r) => toast(`Close circle: ${r.count} ${r.count === 1 ? "person" : "people"}`))
        .catch(() => toast("Couldn't save your close circle"));
      if (ids.length === 0 && d.audience === "close") upd({ audience: "crew" });
    }
    setSheet(null);
    setQ("");
  }

  const rows: { icon: string; label: string; value?: string; hint?: string; toggle?: boolean; on: () => void }[] = [
    ...(d.mode !== "moment" && d.mode !== "loop" ? [{ icon: "📍", label: "Add place", value: d.place ?? "None", on: () => { setQ(""); setSheet("place"); } }] : []),
    ...(d.mode !== "moment"
      ? [
          {
            icon: "👥",
            label: "Tag crew",
            value: taggedCrew.length ? taggedCrew.map((c) => c.handle).slice(0, 2).join(", ") + (taggedCrew.length > 2 ? ` +${taggedCrew.length - 2}` : "") : "None",
            on: () => { setQ(""); setSheet("crew"); },
          },
        ]
      : []),
    ...(d.mode !== "moment" && d.mode !== "take" && d.mode !== "poll" ? [{ icon: "🎵", label: "Add sound", value: d.sound ?? "None", on: () => { setQ(""); setSheet("sound"); } }] : []),
    ...(d.mode === "photo" || d.mode === "collage"
      ? [{ icon: "🎬", label: "Also share as Loop", hint: "Turns photos into a slideshow Loop", toggle: d.alsoLoop, on: () => upd({ alsoLoop: !d.alsoLoop }) }]
      : []),
    ...(usesAudience
      ? [{ icon: "🕒", label: "Schedule", hint: d.schedule ? `${slotDay(slots[d.slot])} · ${dayjs(slots[d.slot]).format("h:mm A")}` : "", toggle: d.schedule, on: () => upd({ schedule: !d.schedule }) }]
      : []),
  ];

  const pubLabel = scheduling ? "Schedule" : "Drop";
  const pubBig = scheduling
    ? `Schedule for ${slotDay(slots[d.slot])}, ${dayjs(slots[d.slot]).format("h:mm A")}`
    : `Drop it${usesAudience && d.audience === "close" ? " to close circle" : usesAudience && d.audience === "crew" ? " to crew" : ""}`;

  // ---- render ---------------------------------------------------------------------------
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.close} onPress={() => navigation.goBack()} accessibilityLabel="Close composer">
          <CloseGlyph size={18} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
          <Text style={styles.title}>New {md[3]}</Text>
          <Text style={styles.draftState}>{saved ? "Draft saved" : "Unsaved draft"}</Text>
        </View>
        <Pressable style={[styles.pubSmall, { backgroundColor: ready ? stream.lime : stream.chip }]} onPress={publish} accessibilityLabel={pubLabel}>
          <Text style={[styles.pubSmallText, { color: ready ? stream.onLime : stream.inkFaint }]}>{pubLabel}</Text>
          <ZapGlyph size={14} color={ready ? stream.onLime : stream.inkFaint} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.modes}>
        {MODES.map(([id, icon, label]) => {
          const on = d.mode === id;
          return (
            <Pressable key={id} onPress={() => upd({ mode: id })} style={[styles.modeChip, { backgroundColor: on ? stream.ink : stream.sheet, borderColor: on ? stream.ink : "#222228" }]} accessibilityState={{ selected: on }}>
              <Text style={{ fontSize: 15 }}>{icon}</Text>
              <Text style={[styles.modeText, { color: on ? stream.bg : stream.inkSoft }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {params.remix ? <Text style={styles.remix}>↻ Remixing @{params.remix.author}'s {params.remix.kind === "take" ? "take" : "poll"}</Text> : null}

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {d.mode === "photo" ? (
          <View style={{ gap: 8 }}>
            <Pressable style={[styles.photoFrame, { aspectRatio: RATIOS[d.ratio][1] }]} onPress={d.photos.length ? undefined : addPhotos} accessibilityLabel={d.photos.length ? "Photo preview" : "Add photos"}>
              {d.photos[cur] ? <Image source={{ uri: d.photos[cur] }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={styles.placeholder}>Tap to add photos</Text>}
              {d.photos.length ? (
                <Text style={styles.photoPos}>
                  {cur + 1} / {d.photos.length}
                  {cur === 0 ? " · Cover" : ""}
                </Text>
              ) : null}
              <View style={styles.ratios}>
                {RATIOS.map(([l], i) => (
                  <Pressable key={l} onPress={() => upd({ ratio: i })} style={[styles.ratio, d.ratio === i && { backgroundColor: stream.ink }]}>
                    <Text style={[styles.ratioText, { color: d.ratio === i ? stream.bg : stream.ink }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              {cur > 0 && d.photos[cur] ? (
                <Pressable
                  style={styles.makeCover}
                  onPress={() => {
                    const p = [...d.photos];
                    const [picked] = p.splice(cur, 1);
                    upd({ photos: [picked, ...p] });
                    setCur(0);
                  }}
                >
                  <Text style={styles.makeCoverText}>Set as cover</Text>
                </Pressable>
              ) : null}
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 4 }}>
              {d.photos.map((uri, i) => (
                <View key={`${uri}-${i}`} style={styles.thumbWrap}>
                  <Pressable onPress={() => setCur(i)} style={[styles.thumb, { borderColor: i === cur ? stream.lime : "transparent" }]} accessibilityLabel={`Photo ${i + 1}`}>
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} />
                  </Pressable>
                  <Pressable
                    style={styles.thumbRemove}
                    onPress={() => {
                      const p = d.photos.filter((_, j) => j !== i);
                      upd({ photos: p });
                      setCur((c) => Math.max(0, Math.min(c, p.length - 1)));
                    }}
                    accessibilityLabel={`Remove photo ${i + 1}`}
                  >
                    <CloseGlyph size={9} color={stream.bg} />
                  </Pressable>
                </View>
              ))}
              {d.photos.length < 10 ? (
                <Pressable style={styles.addThumb} onPress={addPhotos} accessibilityLabel="Add photos">
                  <Text style={styles.addThumbPlus}>+</Text>
                  <Text style={styles.addThumbText}>{10 - d.photos.length} left</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {d.mode === "loop" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable style={styles.loopFrame} onPress={pickVideo} accessibilityLabel={video ? "Change video" : "Pick a video"}>
              {video ? <LoopVideo url={video.uri} rate={speed} trimEnd={trimLen} /> : <Text style={styles.placeholder}>Tap to pick a video</Text>}
              <Text style={styles.loopBadge}>
                ▶ {trimLen}s · {speed}x
              </Text>
              {d.sound ? (
                <Text style={styles.loopSound} numberOfLines={1}>
                  ♪ {d.sound}
                </Text>
              ) : null}
            </Pressable>
            <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
              <View style={{ gap: 6 }}>
                <Text style={styles.eyebrow}>LENGTH</Text>
                <View style={styles.grid2}>
                  {LENGTHS.map((n) => (
                    <Pressable key={n} onPress={() => setLoopLen(n)} style={[styles.lenChip, loopLen === n && styles.lenChipOn]}>
                      <Text style={[styles.chipText, { color: loopLen === n ? stream.onLime : stream.inkSoft }]}>{n}s</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <Text style={styles.eyebrow}>SPEED</Text>
                <View style={styles.segment}>
                  {SPEEDS.map((v) => (
                    <Pressable key={v} onPress={() => setSpeed(v)} style={[styles.segBtn, speed === v && { backgroundColor: stream.ink }]}>
                      <Text style={[styles.segText, { color: speed === v ? stream.bg : stream.inkMuted }]}>{v}x</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.eyebrow}>TRIM</Text>
                  <Text style={[styles.eyebrow, { color: stream.lime }]}>{trimLen}s</Text>
                </View>
                <View style={styles.trimTrack}>
                  <View style={[styles.trimWindow, { right: `${100 - trimEnd}%` }]} />
                </View>
                <Slider value={trimEnd} min={10} max={100} onChange={setTrimEnd} accessibilityLabel="Trim end" />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={styles.eyebrow}>EFFECTS</Text>
                <View style={styles.wrap}>
                  {EFFECTS.map((f) => (
                    <Pressable key={f} onPress={() => setEffects((x) => ({ ...x, [f]: !x[f] }))} style={[styles.fx, effects[f] && styles.fxOn]}>
                      <Text style={[styles.fxText, { color: effects[f] ? stream.lime : stream.inkSoft }]}>{f}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {d.mode === "collage" ? (
          <View style={{ gap: 10 }}>
            <CollageCanvas
              ref={collageRef}
              layout={layout}
              gap={d.gap}
              frame={FRAME_COLORS[d.frame]}
              images={collageImgs}
              onPickCell={async (i) => {
                const [uri] = await pickImages(1);
                if (uri) setCollageImgs((x) => { const n = [...x]; n[i] = uri; return n; });
              }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {COLLAGE_LAYOUTS.map((l, i) => (
                <LayoutThumb key={i} layout={l} active={d.layout === i} onPress={() => upd({ layout: i })} />
              ))}
            </ScrollView>
            <View style={styles.card}>
              <Text style={styles.spacingLabel}>Spacing</Text>
              <View style={{ flex: 1 }}>
                <Slider value={d.gap} min={0} max={14} onChange={(v) => upd({ gap: v })} accessibilityLabel="Collage spacing" />
              </View>
              {FRAME_COLORS.map((c, i) => (
                <Pressable key={c} onPress={() => upd({ frame: i })} style={[styles.frameSwatch, { backgroundColor: c, borderColor: d.frame === i ? stream.lime : stream.ringSeen }]} accessibilityLabel={`Frame colour ${i + 1}`} />
              ))}
            </View>
          </View>
        ) : null}

        {d.mode === "moment" ? (
          <View style={{ alignItems: "center", gap: 10 }}>
            <Pressable style={styles.momentFrame} onPress={async () => { const [u] = await pickImages(1); if (u) setMomentPhoto(u); }} accessibilityLabel="Add a moment photo">
              {momentPhoto ? <Image source={{ uri: momentPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={styles.placeholder}>Tap to add a photo</Text>}
              <View style={styles.momentBar} />
              {d.overlay.trim() ? (
                <View style={styles.overlayWrap} pointerEvents="none">
                  <Text style={[styles.overlay, { backgroundColor: OVERLAYS[d.overlayColor][0], color: OVERLAYS[d.overlayColor][1] }]}>{d.overlay}</Text>
                </View>
              ) : null}
            </Pressable>
            <View style={styles.overlayRow}>
              <Text style={styles.aa}>Aa</Text>
              <TextInput value={d.overlay} onChangeText={(t) => upd({ overlay: t.slice(0, 80) })} placeholder="Add a text sticker" placeholderTextColor={stream.inkFaint} style={styles.overlayInput} />
              {OVERLAYS.map(([c], i) => (
                <Pressable key={c} onPress={() => upd({ overlayColor: i })} style={[styles.dot, { backgroundColor: c, borderColor: d.overlayColor === i ? stream.ink : stream.ringSeen }]} accessibilityLabel={`Sticker colour ${i + 1}`} />
              ))}
            </View>
            <Text style={styles.note}>Disappears after 24h · your crew can reply</Text>
          </View>
        ) : null}

        {d.mode === "take" ? (
          <View style={{ gap: 10 }}>
            <View style={[styles.takeCard, { backgroundColor: TAKE_COLORS[d.takeColor] }]}>
              <Text style={[styles.takeEyebrow, { color: TAKE_INK[TAKE_COLORS[d.takeColor]] ?? stream.onLime }]}>HOT TAKE</Text>
              <TextInput
                value={d.take}
                onChangeText={(t) => upd({ take: t.slice(0, 120) })}
                placeholder="Say the thing everyone's thinking…"
                placeholderTextColor={(TAKE_INK[TAKE_COLORS[d.takeColor]] ?? "#0C0C0E") + "99"}
                multiline
                maxLength={120}
                style={[styles.takeInput, { color: TAKE_INK[TAKE_COLORS[d.takeColor]] ?? stream.onLime }]}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["🔥 Facts", "🧢 Cap"].map((l) => (
                  <View key={l} style={styles.stance}>
                    <Text style={[styles.stanceText, { color: TAKE_INK[TAKE_COLORS[d.takeColor]] ?? stream.onLime }]}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
              {TAKE_COLORS.map((c, i) => (
                <Pressable key={c} onPress={() => upd({ takeColor: i })} style={[styles.takeSwatch, { backgroundColor: c, borderColor: d.takeColor === i ? stream.ink : "transparent" }]} accessibilityLabel={`Take colour ${i + 1}`} />
              ))}
            </View>
            <Text style={[styles.note, { alignSelf: "center" }]}>{d.take.length}/120</Text>
          </View>
        ) : null}

        {d.mode === "poll" ? (
          <View style={styles.pollCard}>
            <Text style={[styles.eyebrow, { color: stream.lime }]}>POLL</Text>
            <TextInput value={d.pollQ} onChangeText={(t) => upd({ pollQ: t.slice(0, 200) })} placeholder="Ask something spicy…" placeholderTextColor={stream.inkFaint} style={styles.pollQ} />
            {d.opts.map((o, i) => (
              <View key={i} style={styles.opt}>
                <Text style={styles.optLetter}>{"ABCD"[i]}</Text>
                <TextInput
                  value={o}
                  onChangeText={(t) => upd({ opts: d.opts.map((x, j) => (j === i ? t.slice(0, 60) : x)) })}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={stream.inkFaint}
                  style={styles.optInput}
                />
                {d.opts.length > 2 ? (
                  <Pressable style={styles.optRemove} onPress={() => upd({ opts: d.opts.filter((_, j) => j !== i) })} accessibilityLabel={`Remove option ${i + 1}`}>
                    <CloseGlyph size={13} color={stream.inkFaint} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <View style={styles.rowBetween}>
              {d.opts.length < 4 ? (
                <Pressable style={styles.addOpt} onPress={() => upd({ opts: [...d.opts, ""] })}>
                  <Text style={styles.addOptText}>+ Add option</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <View style={styles.segmentSm}>
                {POLL_DURATIONS.map(([l], i) => (
                  <Pressable key={l} onPress={() => upd({ pollDur: i })} style={[styles.segBtnSm, d.pollDur === i && { backgroundColor: stream.ink }]} accessibilityLabel={`Poll lasts ${l}`}>
                    <Text style={[styles.segText, { color: d.pollDur === i ? stream.bg : stream.inkMuted }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {d.mode !== "take" && d.mode !== "moment" ? (
          <View style={[styles.captionCard, { borderColor: captionFocus ? stream.lime : "#1F1F24" }]}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {user ? <Avatar handle={user.handle} displayName={user.displayName} avatarUrl={user.avatarUrl} size={32} radius={11} /> : null}
              <TextInput
                value={d.caption}
                onChangeText={(t) => upd({ caption: t.slice(0, 280) })}
                onFocus={() => setCaptionFocus(true)}
                onBlur={() => setCaptionFocus(false)}
                multiline
                maxLength={280}
                placeholder="Say something worth bantering about…"
                placeholderTextColor={stream.inkFaint}
                style={styles.captionInput}
              />
            </View>
            {tags.length ? (
              <View style={[styles.wrap, { paddingLeft: 42 }]}>
                {tags.map((t) => (
                  <Text key={t} style={styles.tagChip}>
                    {t}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.captionFoot}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 5 }}>
                {suggestions.map((t) => (
                  <Pressable key={t} style={styles.sugg} onPress={() => upd({ caption: `${d.caption.trim()} ${t} `.trimStart().slice(0, 280) })}>
                    <Text style={styles.suggText}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={[styles.count, d.caption.length > 250 && { color: "#FFB020" }]}>{d.caption.length}/280</Text>
            </View>
          </View>
        ) : null}

        {rows.length ? (
          <View style={styles.list}>
            {rows.map((r, i) => (
              <Pressable key={r.label} onPress={r.on} style={({ pressed }) => [styles.listRow, i > 0 && styles.listSep, pressed && { backgroundColor: "#18181C" }]} accessibilityLabel={r.label}>
                <View style={styles.listIcon}>
                  <Text style={{ fontSize: 16 }}>{r.icon}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Text style={styles.listLabel}>{r.label}</Text>
                  {r.hint ? <Text style={styles.listHint}>{r.hint}</Text> : null}
                </View>
                {r.toggle !== undefined ? (
                  <Toggle on={r.toggle} />
                ) : (
                  <>
                    <Text style={[styles.listValue, { color: r.value && r.value !== "None" ? stream.lime : stream.inkFaint }]} numberOfLines={1}>
                      {r.value}
                    </Text>
                    <Text style={styles.chev}>›</Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        ) : null}

        {scheduling ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {slots.map((t, i) => (
              <Pressable key={t.toISOString()} onPress={() => upd({ slot: i })} style={[styles.slot, d.slot === i && { backgroundColor: stream.lime, borderColor: stream.lime }]}>
                <Text style={[styles.slotDay, { color: d.slot === i ? stream.onLime : stream.ink }]}>{slotDay(t)}</Text>
                <Text style={[styles.slotTime, { color: d.slot === i ? stream.onLime : stream.ink }]}>{dayjs(t).format("h:mm A")}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {usesAudience ? (
          <View style={{ gap: 8 }}>
            <Text style={[styles.eyebrow, { paddingHorizontal: 4 }]}>WHO SEES THIS</Text>
            <View style={styles.audience}>
              {AUDIENCES.map(([id, icon, label]) => (
                <Pressable key={id} onPress={() => chooseAudience(id)} onLongPress={() => id === "close" && (setQ(""), setSheet("close"))} style={[styles.audBtn, d.audience === id && { backgroundColor: stream.ink }]} accessibilityLabel={label}>
                  <Text style={{ fontSize: 13 }}>{icon}</Text>
                  <Text style={[styles.audText, { color: d.audience === id ? stream.bg : stream.inkSoft }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {d.audience === "close" ? (
              <Pressable onPress={() => { setQ(""); setSheet("close"); }}>
                <Text style={styles.editCircle}>Edit close circle · {Object.values(circle).filter(Boolean).length} people</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {usesAudience ? (
          <View style={styles.list}>
            <Pressable style={[styles.listRow, { justifyContent: "space-between" }]} onPress={() => setAdvanced((a) => !a)} accessibilityLabel="Advanced">
              <Text style={styles.listLabel}>Advanced</Text>
              <Text style={[styles.chev, { transform: [{ rotate: advanced ? "-90deg" : "90deg" }] }]}>›</Text>
            </Pressable>
            {advanced ? (
              <>
                {(
                  [
                    ["commentsOff", "Turn off banter (comments)"],
                    ["hideCounts", "Hide cheer counts"],
                    ["allowRemix", "Allow remixes"],
                  ] as const
                ).map(([k, label]) => (
                  <Pressable key={k} style={[styles.listRow, styles.listSep]} onPress={() => upd({ [k]: !d[k] } as Partial<Draft>)} accessibilityLabel={label}>
                    <Text style={[styles.listLabel, { flex: 1 }]}>{label}</Text>
                    <Toggle on={d[k]} />
                  </Pressable>
                ))}
                <View style={[styles.listSep, { padding: 14, gap: 6 }]}>
                  <Text style={styles.listHint}>Alt text</Text>
                  <TextInput value={d.alt} onChangeText={(t) => upd({ alt: t.slice(0, 300) })} placeholder="Describe your drop for screen readers" placeholderTextColor={stream.inkFaint} style={styles.altInput} />
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.saveDraft} onPress={saveDraft}>
          <Text style={styles.saveDraftText}>Save draft</Text>
        </Pressable>
        <Pressable style={[styles.pubBig, { backgroundColor: ready ? stream.lime : stream.chip }]} onPress={publish} accessibilityLabel={pubBig}>
          <Text style={[styles.pubBigText, { color: ready ? stream.onLime : stream.inkFaint }]}>{pubBig}</Text>
        </Pressable>
      </View>

      <PickerSheet visible={!!sheet} title={pickerTitle} query={q} onQuery={setQ} rows={pickerRows} multi={sheet === "crew" || sheet === "close"} onClose={closeSheet} footer={pickerFooter} />

      {pub ? (
        <PublishOverlay
          done={pub === "done"}
          progress={pubP}
          modeName={md[3]}
          scheduled={scheduling ? `${slotDay(slots[d.slot])} at ${dayjs(slots[d.slot]).format("h:mm A")}` : null}
          info={pubInfo}
          onView={() => navigation.navigate("Tabs", { screen: d.mode === "loop" ? "Me" : "Stream" })}
          onNew={reset}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, { backgroundColor: on ? stream.lime : stream.ringSeen }]}>
      <View style={[styles.knob, { left: on ? 21 : 3 }]} />
    </View>
  );
}

function PublishOverlay({
  done,
  progress,
  modeName,
  scheduled,
  info,
  onView,
  onNew,
}: {
  done: boolean;
  progress: number;
  modeName: string;
  scheduled: string | null;
  info: string;
  onView: () => void;
  onNew: () => void;
}) {
  const conf = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!done) return;
    conf.setValue(0);
    Animated.timing(conf, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [done, conf]);
  return (
    <View style={styles.pubOverlay}>
      {done ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 24 }, (_, i) => (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                left: `${i * 4.1 + 2}%`,
                top: "30%",
                width: 8,
                height: 12,
                borderRadius: 2,
                backgroundColor: [stream.lime, "#FF7AB6", "#7B9CFF", "#FFB020"][i % 4],
                opacity: conf.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateY: conf.interpolate({ inputRange: [0, 1], outputRange: [0, 120 + (i % 6) * 18] }) },
                  { rotate: conf.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${200 + i * 9}deg`] }) },
                ],
              }}
            />
          ))}
        </View>
      ) : null}
      <View style={[styles.pubIcon, { backgroundColor: done ? stream.lime : stream.raised }]}>
        {done ? <Text style={{ fontSize: 34, color: stream.onLime }}>✓</Text> : <ZapGlyph size={34} color={stream.lime} />}
      </View>
      <Text style={styles.pubTitle}>{done ? (scheduled ? "Scheduled!" : "Dropped!") : `Uploading your ${modeName}…`}</Text>
      {!done ? (
        <View style={styles.pubTrack}>
          <View style={[styles.pubFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
      <Text style={styles.pubSub}>
        {done ? (scheduled ? `Goes live ${scheduled}.` : `Your ${modeName} is live${info}.`) : `${Math.round(progress * 100)}% · don't close the app`}
      </Text>
      {!done ? <ActivityIndicator color={stream.inkMuted} /> : null}
      {done ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <Pressable style={styles.pubPrimary} onPress={onView}>
            <Text style={styles.pubPrimaryText}>View in Stream</Text>
          </Pressable>
          <Pressable style={styles.pubSecondary} onPress={onNew}>
            <Text style={styles.pubSecondaryText}>New drop</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stream.bg, paddingTop: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingHorizontal: 12 },
  close: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#18181C", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 17, letterSpacing: -0.3, color: stream.ink },
  draftState: { fontFamily: fonts.body, fontSize: 11, color: stream.inkMuted },
  pubSmall: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 14 },
  pubSmallText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  modes: { gap: 6, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  modeChip: { flexDirection: "row", alignItems: "center", gap: 7, height: 38, paddingLeft: 10, paddingRight: 13, borderWidth: 1, borderRadius: 13 },
  modeText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  remix: { marginHorizontal: 12, marginBottom: 8, fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.lime },
  body: { paddingHorizontal: 12, paddingBottom: 130, gap: 12 },
  placeholder: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: stream.inkMuted },
  photoFrame: { borderRadius: 26, overflow: "hidden", backgroundColor: stream.card, borderWidth: 1, borderColor: "#222228", alignItems: "center", justifyContent: "center" },
  photoPos: { position: "absolute", left: 12, top: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(12,12,14,0.8)", color: stream.ink, fontFamily: fonts.bodySemibold, fontSize: 11.5 },
  ratios: { position: "absolute", right: 10, top: 10, flexDirection: "row", gap: 4, padding: 3, borderRadius: 12, backgroundColor: "rgba(12,12,14,0.8)" },
  ratio: { height: 26, paddingHorizontal: 8, borderRadius: 9, justifyContent: "center" },
  ratioText: { fontFamily: fonts.bodySemibold, fontSize: 11 },
  makeCover: { position: "absolute", bottom: 12, alignSelf: "center", paddingHorizontal: 12, height: 30, borderRadius: 10, backgroundColor: "rgba(12,12,14,0.85)", justifyContent: "center" },
  makeCoverText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: stream.lime },
  thumbWrap: { width: 58, height: 58 },
  thumb: { width: 58, height: 58, borderRadius: 16, borderWidth: 2, overflow: "hidden", backgroundColor: stream.card },
  thumbRemove: { position: "absolute", right: -4, top: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: stream.bg, backgroundColor: stream.ink, alignItems: "center", justifyContent: "center" },
  addThumb: { width: 58, height: 58, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#3A3A42", alignItems: "center", justifyContent: "center" },
  addThumbPlus: { color: stream.lime, fontSize: 18, lineHeight: 20 },
  addThumbText: { fontFamily: fonts.bodySemibold, fontSize: 10, color: stream.lime },
  loopFrame: { width: 176, aspectRatio: 9 / 16, borderRadius: 24, overflow: "hidden", backgroundColor: stream.card, borderWidth: 1, borderColor: "#222228", alignItems: "center", justifyContent: "center" },
  loopBadge: { position: "absolute", left: 10, top: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(12,12,14,0.8)", color: stream.ink, fontFamily: fonts.bodyBold, fontSize: 11 },
  loopSound: { position: "absolute", left: 10, right: 10, bottom: 10, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(12,12,14,0.8)", color: stream.ink, fontFamily: fonts.bodySemibold, fontSize: 11 },
  eyebrow: { fontFamily: fonts.bodySemibold, fontSize: 11, letterSpacing: 1.3, color: stream.inkMuted },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  lenChip: { width: "48%", height: 32, borderRadius: 10, borderWidth: 1, borderColor: stream.raisedBorder, alignItems: "center", justifyContent: "center" },
  lenChipOn: { backgroundColor: stream.lime, borderColor: stream.lime },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 12.5 },
  segment: { flexDirection: "row", gap: 4, padding: 3, borderRadius: 11, backgroundColor: stream.card },
  segBtn: { flex: 1, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segText: { fontFamily: fonts.bodySemibold, fontSize: 11.5 },
  segmentSm: { flexDirection: "row", gap: 4, padding: 3, borderRadius: 11, backgroundColor: stream.raised },
  segBtnSm: { height: 28, paddingHorizontal: 10, borderRadius: 8, justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trimTrack: { height: 40, borderRadius: 10, overflow: "hidden", backgroundColor: "#26262C" },
  trimWindow: { position: "absolute", top: 0, bottom: 0, left: "4%", borderWidth: 2.5, borderColor: stream.lime, borderRadius: 10, backgroundColor: "rgba(200,241,105,0.12)" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  fx: { height: 28, paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: stream.raisedBorder, justifyContent: "center" },
  fxOn: { backgroundColor: "rgba(200,241,105,0.14)", borderColor: stream.lime },
  fxText: { fontFamily: fonts.bodySemibold, fontSize: 11.5 },
  card: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24" },
  spacingLabel: { width: 56, fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.inkMuted },
  frameSwatch: { width: 24, height: 24, borderRadius: 8, borderWidth: 2 },
  momentFrame: { width: 230, aspectRatio: 9 / 16, borderRadius: 28, overflow: "hidden", backgroundColor: stream.card, borderWidth: 1, borderColor: "#222228", alignItems: "center", justifyContent: "center" },
  momentBar: { position: "absolute", left: 10, right: 10, top: 10, height: 3, borderRadius: 2, backgroundColor: "#fff" },
  overlayWrap: { position: "absolute", left: 16, right: 16, top: "44%", alignItems: "center" },
  overlay: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, overflow: "hidden", fontFamily: fonts.display, fontSize: 22, lineHeight: 24, textAlign: "center", transform: [{ rotate: "-3deg" }] },
  overlayRow: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 8, height: 46, paddingLeft: 14, paddingRight: 6, borderRadius: 16, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24" },
  aa: { fontFamily: fonts.display, fontSize: 16, color: stream.inkMuted },
  overlayInput: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 14.5, color: stream.ink, paddingVertical: 0 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  note: { fontFamily: fonts.body, fontSize: 12, color: stream.inkMuted },
  takeCard: { minHeight: 300, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, borderRadius: 26, gap: 16 },
  takeEyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.8 },
  takeInput: { flex: 1, minHeight: 150, fontFamily: fonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.9, textAlignVertical: "top" },
  stance: { flex: 1, height: 40, borderRadius: 13, backgroundColor: "rgba(12,12,14,0.2)", alignItems: "center", justifyContent: "center" },
  stanceText: { fontFamily: fonts.bodySemibold, fontSize: 13.5 },
  takeSwatch: { width: 34, height: 34, borderRadius: 12, borderWidth: 2 },
  pollCard: { gap: 8, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 14, borderRadius: 26, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24" },
  pollQ: { fontFamily: fonts.display, fontSize: 23, lineHeight: 27, color: stream.ink, paddingTop: 4, paddingBottom: 8 },
  opt: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingLeft: 14, paddingRight: 6, borderWidth: 1.5, borderColor: stream.raisedBorder, borderRadius: 14 },
  optLetter: { fontFamily: fonts.bodyBold, fontSize: 13, color: stream.inkFaint },
  optInput: { flex: 1, minWidth: 0, fontFamily: fonts.bodyMedium, fontSize: 14.5, color: stream.ink, paddingVertical: 0 },
  optRemove: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  addOpt: { height: 34, paddingHorizontal: 12, borderRadius: 11, backgroundColor: stream.raised, justifyContent: "center" },
  addOptText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: stream.lime },
  captionCard: { gap: 8, padding: 14, borderRadius: 22, backgroundColor: stream.sheet, borderWidth: 1.5 },
  captionInput: { flex: 1, minWidth: 0, minHeight: 64, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: stream.ink, paddingTop: 6, textAlignVertical: "top" },
  tagChip: { height: 24, lineHeight: 24, paddingHorizontal: 9, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(200,241,105,0.12)", color: stream.lime, fontFamily: fonts.bodySemibold, fontSize: 12 },
  captionFoot: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#1F1F24" },
  sugg: { height: 26, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: stream.raisedBorder, justifyContent: "center" },
  suggText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: stream.inkSoft },
  count: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: stream.inkFaint },
  list: { borderRadius: 22, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24", overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, paddingHorizontal: 14 },
  listSep: { borderTopWidth: 1, borderTopColor: "#1C1C21" },
  listIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: stream.raised, alignItems: "center", justifyContent: "center" },
  listLabel: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: stream.ink },
  listHint: { fontFamily: fonts.body, fontSize: 11.5, color: stream.inkFaint },
  listValue: { maxWidth: 130, fontFamily: fonts.bodyMedium, fontSize: 13 },
  chev: { fontSize: 18, color: "#55535C" },
  toggle: { width: 44, height: 26, borderRadius: 13 },
  knob: { position: "absolute", top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: stream.ink },
  slot: { width: 84, height: 62, borderRadius: 16, borderWidth: 1, borderColor: "#222228", backgroundColor: stream.sheet, alignItems: "center", justifyContent: "center", gap: 3 },
  slotDay: { fontFamily: fonts.display, fontSize: 14 },
  slotTime: { fontFamily: fonts.bodyMedium, fontSize: 11.5 },
  audience: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 16, backgroundColor: stream.sheet, borderWidth: 1, borderColor: "#1F1F24" },
  audBtn: { flex: 1, height: 40, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  audText: { fontFamily: fonts.bodySemibold, fontSize: 12.5 },
  editCircle: { paddingHorizontal: 4, fontFamily: fonts.bodySemibold, fontSize: 12.5, color: stream.lime },
  altInput: { height: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: stream.raisedBorder, borderRadius: 12, backgroundColor: stream.raised, color: stream.ink, fontFamily: fonts.body, fontSize: 13.5 },
  noteGlyph: { fontSize: 16, color: stream.onLime, fontFamily: fonts.bodyBold },
  pickerHint: { fontFamily: fonts.body, fontSize: 13, color: stream.inkMuted, textAlign: "center", paddingVertical: 16 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 30, backgroundColor: "rgba(12,12,14,0.96)" },
  saveDraft: { height: 52, paddingHorizontal: 18, borderRadius: 17, borderWidth: 1, borderColor: stream.raisedBorder, backgroundColor: stream.sheet, justifyContent: "center" },
  saveDraftText: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
  pubBig: { flex: 1, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  pubBigText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  pubOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 90, backgroundColor: "rgba(12,12,14,0.96)", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  pubIcon: { width: 84, height: 84, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  pubTitle: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.8, color: stream.ink, textAlign: "center" },
  pubTrack: { width: 220, height: 6, borderRadius: 3, backgroundColor: stream.chip, overflow: "hidden" },
  pubFill: { height: "100%", borderRadius: 3, backgroundColor: stream.lime },
  pubSub: { maxWidth: 260, fontFamily: fonts.body, fontSize: 14, color: stream.inkMuted, textAlign: "center" },
  pubPrimary: { height: 46, paddingHorizontal: 20, borderRadius: 15, backgroundColor: stream.lime, justifyContent: "center" },
  pubPrimaryText: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: stream.onLime },
  pubSecondary: { height: 46, paddingHorizontal: 18, borderRadius: 15, borderWidth: 1, borderColor: "#2E2E35", justifyContent: "center" },
  pubSecondaryText: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: stream.ink },
});
