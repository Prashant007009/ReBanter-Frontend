import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

export function PlusIcon({ size = 18, color = "#5B3CFF", strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M12 6v12M6 12h12" />
    </Svg>
  );
}
