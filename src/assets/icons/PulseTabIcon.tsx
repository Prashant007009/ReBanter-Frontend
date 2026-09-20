import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

export function PulseTabIcon({ size = 20, color = "#8D857B", strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12.5h4l2.5-6 4 12 2.5-6h5" />
    </Svg>
  );
}
