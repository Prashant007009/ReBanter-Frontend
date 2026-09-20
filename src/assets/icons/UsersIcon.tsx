import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

/** Two overlapping people — "Tag crew" row in the composer. */
export function UsersIcon({ size = 19, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="9" cy="8" r="3.4" />
      <Path d="M3 19a6 6 0 0 1 12 0M17 11a3 3 0 1 0-1.5-5.6" />
    </Svg>
  );
}
