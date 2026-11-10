import Svg, { Path, Rect } from "react-native-svg";
import type { IconProps } from "./types";

/** Rounded rect with a play triangle — video call header icon / "share as Loop" row icon. */
export function VideoIcon({ size = 21, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2.5" y="6" width="13" height="12" rx="3.5" />
      <Path d="m15.5 12 6-3.5v7z" />
    </Svg>
  );
}
