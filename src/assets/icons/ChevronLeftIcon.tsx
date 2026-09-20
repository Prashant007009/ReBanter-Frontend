import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

export function ChevronLeftIcon({ size = 22, color = "#171412", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}
