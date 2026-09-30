import Svg, { Ellipse, Rect } from "react-native-svg";
import { brand, colors } from "@/theme/colors";

// Two speech bubbles facing each other — the reply overlapping the
// original — mirrors assets/mark-icon.svg (the rasterized app icon).
// Keep the two in sync if the mark ever changes.
type Props = { size?: number; withBackground?: boolean };

export function BanterMark({ size = 64, withBackground = false }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      {withBackground ? <Rect width={1024} height={1024} rx={224} fill={brand.violet} /> : null}

      <Rect x={230} y={290} width={440} height={320} rx={105} fill="#FFFFFF" />
      <Rect x={320} y={540} width={140} height={140} rx={36} fill="#FFFFFF" transform="rotate(45 390 610)" />

      <Rect x={420} y={470} width={460} height={320} rx={105} fill={colors.cheer} />
      <Rect x={660} y={720} width={140} height={140} rx={36} fill={colors.cheer} transform="rotate(45 730 790)" />
      <Ellipse cx={530} cy={545} rx={55} ry={38} fill="rgba(0,0,0,0.1)" />
    </Svg>
  );
}
