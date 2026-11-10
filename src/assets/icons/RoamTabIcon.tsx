import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

export function RoamTabIcon({ size = 20, color = "#8D857B", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
      <Path d="m15 9-2 4.6L8.4 15.6 10.4 11z" />
    </Svg>
  );
}
