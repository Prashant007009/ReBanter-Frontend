import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

export function MusicNoteIcon({ size = 14, color = "#FFFDFA", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M9 18V5l11-2v13" />
      <Circle cx="6.5" cy="18" r="2.5" />
      <Circle cx="17.5" cy="16" r="2.5" />
    </Svg>
  );
}
