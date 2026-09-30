/**
 * Color primitive tokens.
 *
 * Source: Figma file U06e4NQVyjFgJhDN8dAlKO, node 3:1003 ("design-tokens" style
 * guide), section "1. Color Primitives". Extracted via get_design_context —
 * the file has no bound Figma Variables (get_variable_defs returned an empty
 * set), so these are the raw fill values as authored on the swatch layers.
 *
 * Do not hand-edit hex values here; re-run generation from Figma instead so
 * this file stays traceable to the source of truth.
 */

export const colorPrimitives = {
  purple500: "#5B3CFF",
  purple100: "#EFEBFF",
  coral500: "#E2542F",
  coral100: "#FFEFEA",
  neutral900: "#171412",
  neutral600: "#7D7571",
  neutral200: "#EBE5E1",
  neutral50: "#FBF9F5",
  white: "#FFFFFF",
  cream: "#FFFDFA",
  green500: "#10B981",
  black: "#000000",
} as const;

export type ColorPrimitiveToken = keyof typeof colorPrimitives;
export type ColorPrimitiveValue = (typeof colorPrimitives)[ColorPrimitiveToken];
