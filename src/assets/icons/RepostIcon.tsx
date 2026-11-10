import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

/** Box with an up arrow — used for "repost / send" actions. */
export function RepostIcon({ size = 19, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v7h16v-7M12 3v12M8 7l4-4 4 4" />
    </Svg>
  );
}
