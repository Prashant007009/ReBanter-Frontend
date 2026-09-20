import Svg, { Path, Rect } from "react-native-svg";
import type { IconProps } from "./types";

export function MicIcon({ size = 19, color = "#A79F94", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="9" y="3" width="6" height="11" rx="3" />
      <Path d="M5.5 12a6.5 6.5 0 0 0 13 0M12 18.5V21" />
    </Svg>
  );
}
