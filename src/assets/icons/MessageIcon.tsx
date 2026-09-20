import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

/** Rectangular chat-bubble-with-tail, used for the Stream inbox icon. */
export function MessageIcon({ size = 22, color = "#171412", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 6.5h16v10H9l-4 3.5v-3.5H4z" />
    </Svg>
  );
}
