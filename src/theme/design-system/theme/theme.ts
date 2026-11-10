import { colorPrimitives } from "../tokens/colors";
import { spacing } from "../tokens/spacing";
import { radius } from "../tokens/radius";
import { fontFamilies, fontWeights, typeScale } from "../tokens/typography";
import { semanticColorsLight } from "./semantic";

/**
 * The assembled design system theme — primitives, semantics, spacing,
 * radius, and typography combined into a single object for consumption
 * from React Native `StyleSheet.create()` calls or inline styles.
 *
 * This is a plain TypeScript object (no CSS, no Tailwind/NativeWind config,
 * no styled-components ThemeProvider wiring) because the project is an Expo /
 * React Native app that styles exclusively via `StyleSheet` — see
 * `docs/README.md` for the framework-detection reasoning.
 */
export const theme = {
  colors: {
    ...colorPrimitives,
    ...semanticColorsLight,
  },
  spacing,
  radius,
  typography: {
    fontFamilies,
    fontWeights,
    scale: typeScale,
  },
} as const;

export type Theme = typeof theme;
