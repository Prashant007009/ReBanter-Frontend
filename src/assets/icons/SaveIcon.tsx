import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

export function SaveIcon({ size = 19, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 21v-7M8.5 14h7l-1-6.5 2-2-2.5-3.5h-4L9.5 5.5l2 2z" />
    </Svg>
  );
}
