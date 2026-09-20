import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

export function ClockIcon({ size = 19, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 8v4l3 2" />
    </Svg>
  );
}
