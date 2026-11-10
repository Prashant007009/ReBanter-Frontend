import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

export function StreamTabIcon({ size = 20, color = "#8D857B", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 6h10M4 12h16M4 18h7" />
      <Circle cx="18.5" cy="6" r="2.5" />
      <Circle cx="14.5" cy="18" r="2.5" />
    </Svg>
  );
}
