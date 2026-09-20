import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

/** Single person, no accessory — "wants to join your crew" row. */
export function UserIcon({ size = 18, color = "#5B3CFF", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="8" r="3.4" />
      <Path d="M6 19a6 6 0 0 1 12 0" />
    </Svg>
  );
}
