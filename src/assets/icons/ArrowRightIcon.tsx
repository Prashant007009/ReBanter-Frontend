import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

export function ArrowRightIcon({ size = 20, color = "#FFFDFA", strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12h14M12 6l6 6-6 6" />
    </Svg>
  );
}
