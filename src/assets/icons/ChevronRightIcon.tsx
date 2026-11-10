import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

/** Small list-row disclosure chevron. */
export function ChevronRightIcon({ size = 16, color = "#C4BCB1", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m9 6 6 6-6 6" />
    </Svg>
  );
}
