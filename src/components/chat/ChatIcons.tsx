import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { IconProps } from "@/assets/icons";

// Glyphs specific to the dark chat thread (source: claude.ai design "Rebanter Chat").

export function PhoneIcon({ size = 23, color = "#F5F3EF", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Path d="M6.5 3.5h3l1.8 4.6-2.3 1.5a11 11 0 0 0 5.4 5.4l1.5-2.3 4.6 1.8v3a2 2 0 0 1-2.1 2A16 16 0 0 1 4.5 5.6a2 2 0 0 1 2-2.1z" />
    </Svg>
  );
}

export function CallVideoIcon({ size = 25, color = "#F5F3EF", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Rect x="2.5" y="6" width="13" height="12" rx="3.2" />
      <Path d="M15.5 10.2l5.5-3v9.6l-5.5-3z" />
    </Svg>
  );
}

export function BackIcon({ size = 24, color = "#F5F3EF", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function FaceIcon({ size = 23, color = "#F5F3EF", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Circle cx="12" cy="12" r="9" />
      <Path d="M8.3 14.2a4.6 4.6 0 0 0 7.4 0" />
      <Circle cx="9" cy="9.8" r=".6" fill={color} />
      <Circle cx="15" cy="9.8" r=".6" fill={color} />
    </Svg>
  );
}

export function KeyboardIcon({ size = 23, color = "#F5F3EF", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <Path d="M6 10h.01M9.3 10h.01M12.6 10h.01M16 10h2M6 14h1M9.5 14h5M17 14h1" />
    </Svg>
  );
}

export function StickerIcon({ size = 22, color = "#F5F3EF", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Path d="M20.5 12.5V7.5a4 4 0 0 0-4-4h-9a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h5z" />
      <Path d="M12.5 20.5v-4a4 4 0 0 1 4-4h4" />
    </Svg>
  );
}

export function PhotoIcon({ size = 22, color = "#F5F3EF", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Rect x="3" y="3.5" width="18" height="17" rx="4" />
      <Circle cx="9" cy="9.5" r="1.6" />
      <Path d="M20.5 15l-5-5L4 20" />
    </Svg>
  );
}

export function PlaneIcon({ size = 21, color = "#0C0C0E" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M3.5 11.2L20 3.8c.6-.3 1.2.3.9.9l-7.4 16.5c-.3.6-1.2.6-1.4-.1l-1.9-6.3-6.4-2.1c-.7-.2-.7-1.2-.1-1.5z" />
    </Svg>
  );
}

export function PlusThinIcon({ size = 16, color = "#F5F3EF", strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function SearchThinIcon({ size = 16, color = "#9A98A2", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20 20l-4-4" />
    </Svg>
  );
}

export function BackspaceIcon({ size = 22, color = "#B9B7C0", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M9 5h11a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H9l-6.5-7z" />
      <Path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
    </Svg>
  );
}

export function ClockTickIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 8v4l2.5 2" />
    </Svg>
  );
}

export function SingleTickIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={12} viewBox="0 0 24 20" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 10.5l4.5 4.5L19 5" />
    </Svg>
  );
}

export function DoubleTickIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={12} viewBox="0 0 28 20" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 10.5l4.5 4.5L16 5" />
      <Path d="M12 14l1 1L22.5 5" />
    </Svg>
  );
}
