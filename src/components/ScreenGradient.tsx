import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";

type Props = PropsWithChildren<{ style?: StyleProp<ViewStyle> }>;

// App-wide canvas background — used in place of a plain View so the
// gradient (colors.canvasGradientColors) stays visible behind every
// screen instead of a solid colors.surface/colors.canvas fill.
export function ScreenGradient({ style, children }: Props) {
  return (
    <LinearGradient colors={colors.canvasGradientColors} style={style}>
      {children}
    </LinearGradient>
  );
}
