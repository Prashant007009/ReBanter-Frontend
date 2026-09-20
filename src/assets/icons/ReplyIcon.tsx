import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

export function ReplyIcon({ size = 19, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20.5l1.9-5A8 8 0 1 1 20 11.5z" />
    </Svg>
  );
}
