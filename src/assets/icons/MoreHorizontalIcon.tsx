import Svg, { Circle } from "react-native-svg";
import type { IconProps } from "./types";

export function MoreHorizontalIcon({ size = 19, color = "#A79F94" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="5" cy="12" r="1.7" />
      <Circle cx="12" cy="12" r="1.7" />
      <Circle cx="19" cy="12" r="1.7" />
    </Svg>
  );
}
