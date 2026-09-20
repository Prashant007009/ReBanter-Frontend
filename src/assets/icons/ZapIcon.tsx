import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

/** The "cheer" reaction icon — a filled lightning bolt. */
export function ZapIcon({ size = 19, color = "#E2542F" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M13.5 2 5 13h5.5L9.5 22 19 10h-6z" />
    </Svg>
  );
}
