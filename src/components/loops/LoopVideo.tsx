import { useEffect } from "react";
import { Platform, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

/**
 * A Loop's video, playing on repeat with the settings chosen in the composer:
 * playback speed and a trim window (it jumps back to the start of the window
 * when it reaches the end).
 */
export function LoopVideo({ url, rate = 1, trimStart, trimEnd }: { url: string; rate?: number; trimStart?: number | null; trimEnd?: number | null }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    // Browsers only autoplay muted video.
    p.muted = Platform.OS === "web";
    p.playbackRate = rate;
    if (trimStart) p.currentTime = trimStart;
    p.play();
  });

  useEffect(() => {
    player.playbackRate = rate;
  }, [player, rate]);

  useEffect(() => {
    if (!trimEnd) return;
    player.timeUpdateEventInterval = 0.2;
    const sub = player.addListener("timeUpdate", ({ currentTime }) => {
      if (currentTime >= trimEnd) player.currentTime = trimStart ?? 0;
    });
    return () => sub.remove();
  }, [player, trimStart, trimEnd]);

  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}
