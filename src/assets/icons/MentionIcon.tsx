import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

/** Taller envelope-style bubble used for the "mentioned you" Pulse row. */
export function MentionIcon({ size = 18, color = "#A97F21", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 5h16v11H9l-5 4z" />
    </Svg>
  );
}
