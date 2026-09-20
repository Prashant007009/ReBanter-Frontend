import Svg, { Path, Rect } from "react-native-svg";
import type { IconProps } from "./types";

export function LockIcon({ size = 20, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="11" width="18" height="11" rx="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}
