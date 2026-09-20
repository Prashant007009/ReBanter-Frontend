import Svg, { Circle, Rect } from "react-native-svg";
import type { IconProps } from "./types";

export function CameraIcon({ size = 20, color = "#FFFDFA", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="6.5" width="18" height="13" rx="3.5" />
      <Circle cx="12" cy="13" r="3.6" />
    </Svg>
  );
}
