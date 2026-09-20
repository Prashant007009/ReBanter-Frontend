import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

export function HamburgerIcon({ size = 20, color = "#FFFDFA", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}
