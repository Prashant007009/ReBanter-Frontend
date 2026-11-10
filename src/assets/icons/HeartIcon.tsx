import Svg, { Path } from "react-native-svg";
import type { IconProps } from "./types";

const HEART_PATH = "M12 20.5s-7.5-4.6-10-9.3C.4 7.8 2 4.5 5.3 3.7c2-.5 4 .3 5.2 2 .3.4.9.4 1.2 0 1.2-1.7 3.2-2.5 5.2-2 3.3.8 4.9 4.1 3.3 7.5-2.5 4.7-10 9.3-10 9.3z";

export function HeartIcon({ size = 19, color = "#171412", strokeWidth = 1.8, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={HEART_PATH} />
    </Svg>
  );
}
