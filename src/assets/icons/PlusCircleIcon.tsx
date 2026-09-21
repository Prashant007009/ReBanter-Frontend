import Svg, { Circle, Path } from "react-native-svg";
import type { IconProps } from "./types";

/** Plus inside a circle — the "crew request" notification glyph. */
export function PlusCircleIcon({ size = 16, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Path d="M8 12h8" />
      <Path d="M12 8v8" />
    </Svg>
  );
}
