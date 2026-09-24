import Svg, { Circle, Path, Rect } from "react-native-svg";

// Glyphs for Stream and the floating tab bar (source: claude.ai design "Rebanter Stream").

type P = { size?: number; color?: string };
const HEART = "M12 20.5s-7.5-4.4-9.3-9.2C1.5 7.9 3.8 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.8 1.3-1.7 2.8-2.8 4.8-2.8 3.4 0 5.7 3.4 4.5 6.8-1.8 4.8-9.3 9.2-9.3 9.2z";

export function SearchGlyph({ size = 24, color = "#F5F3EF" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20.5 20.5l-4.5-4.5" />
    </Svg>
  );
}

export function ChatGlyph({ size = 24, color = "#F5F3EF", strokeWidth = 2 }: P & { strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.2-4.2A8.5 8.5 0 1 1 20.5 12z" />
    </Svg>
  );
}

export function HeartGlyph({ size = 25, color = "#F5F3EF", filled = false, fillColor = "#FF4D4D", strokeWidth = 1.9 }: P & { filled?: boolean; fillColor?: string; strokeWidth?: number }) {
  return filled ? (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={HEART} fill={fillColor} />
    </Svg>
  ) : (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Path d={HEART} />
    </Svg>
  );
}

export function ShareGlyph({ size = 23, color = "#F5F3EF" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M21 3.5L10.4 13.6M21 3.5l-6.3 17-4.3-6.9-6.9-4.3z" />
    </Svg>
  );
}

export function BookmarkGlyph({ size = 23, color = "#F5F3EF", filled = false }: P & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth={1.9} strokeLinejoin="round">
      <Path d="M6 3.5h12v17l-6-4.5-6 4.5z" />
    </Svg>
  );
}

export function DotsGlyph({ size = 20, color = "#F5F3EF" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="5.5" cy="12" r="1.6" />
      <Circle cx="12" cy="12" r="1.6" />
      <Circle cx="18.5" cy="12" r="1.6" />
    </Svg>
  );
}

export function VerifiedGlyph({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.1z" fill="#C8F169" />
      <Path d="M8 12.3l2.7 2.7L16.2 9.5" fill="none" stroke="#0C0C0E" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronGlyph({ size = 15, color = "#0C0C0E", direction = "right" }: P & { direction?: "left" | "right" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </Svg>
  );
}

export function CheckGlyph({ size = 16, color = "#C8F169", strokeWidth = 3 }: P & { strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  );
}

export function PlusGlyph({ size = 24, color = "#0C0C0E", strokeWidth = 2.8 }: P & { strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CloseGlyph({ size = 24, color = "#F5F3EF" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function PlayPauseGlyph({ paused, size = 18, color = "#F5F3EF" }: P & { paused: boolean }) {
  return paused ? (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M7 4.5l13 7.5-13 7.5z" />
    </Svg>
  ) : (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x="5" y="4" width="5" height="16" rx="1.5" />
      <Rect x="14" y="4" width="5" height="16" rx="1.5" />
    </Svg>
  );
}

// ---- Tab bar -------------------------------------------------------------

export function StreamTabGlyph({ size = 24, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M3 7.5c3-3 6 3 9 0s6-3 9 0M3 12c3-3 6 3 9 0s6-3 9 0M3 16.5c3-3 6 3 9 0s6-3 9 0" />
    </Svg>
  );
}

export function RoamTabGlyph({ size = 24, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
      <Path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z" />
    </Svg>
  );
}

export function PulseTabGlyph({ size = 24, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2.5 12h4l2.5-6 4.5 12 2.5-6h5.5" />
    </Svg>
  );
}
