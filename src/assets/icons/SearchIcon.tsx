import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

export function SearchIcon({ size = 22, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Circle cx="11" cy="11" r="7.5" />
      <Path d="m17 17 4 4" />
    </Svg>
  );
}
