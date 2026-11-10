import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

/** Person with a "+" — "joined your crew" Pulse row. */
export function UserPlusIcon({ size = 18, color = "#0F0E47", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="10" cy="8" r="3.4" />
      <Path d="M4 19a6 6 0 0 1 12 0M19 8v6M22 11h-6" />
    </Svg>
  );
}
