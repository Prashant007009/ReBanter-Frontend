import Svg, { Line, Polyline } from "react-native-svg";
import type { IconProps } from "./types";

/** Diagonal arrow pointing up-left — the "reply" notification glyph. */
export function ArrowUpLeftIcon({ size = 16, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="17" y1="17" x2="7" y2="7" />
      <Polyline points="7 17 7 7 17 7" />
    </Svg>
  );
}
