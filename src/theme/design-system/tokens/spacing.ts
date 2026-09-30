/**
 * Spacing scale tokens.
 *
 * Source: Figma node 3:1003, section "4. Spacing Scale". Each row's bar width
 * in the style guide encodes the pixel value directly (e.g. "xxs/4" = 4px).
 * Values are unitless numbers, matching React Native's `padding`/`margin`/`gap`
 * props, which take raw density-independent pixels rather than a CSS unit.
 */

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
} as const;

export type SpacingToken = keyof typeof spacing;
export type SpacingValue = (typeof spacing)[SpacingToken];
